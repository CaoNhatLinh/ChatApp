package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.messaging.OutboxRepository.OutboxEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
@ConditionalOnProperty(prefix = "app.integrations.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class CassandraOutboxPublisher {
    private static final Logger LOG = LoggerFactory.getLogger(CassandraOutboxPublisher.class);
    private static final DateTimeFormatter PARTITION = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH")
            .withZone(ZoneOffset.UTC);

    private final OutboxRepository outbox;
    private final DomainEventPublisher eventPublisher;
    private final int batchSize;
    private final int lookbackHours;
    private final UUID[] reportCursors = new UUID[ReportOutboxRoute.SHARDS];
    private int reportShard;

    public CassandraOutboxPublisher(
            OutboxRepository outbox,
            DomainEventPublisher eventPublisher,
            @Value("${app.kafka.outbox.batch-size:100}") int batchSize,
            @Value("${app.kafka.outbox.lookback-hours:24}") int lookbackHours) {
        this.outbox = outbox;
        this.eventPublisher = eventPublisher;
        this.batchSize = Math.max(1, Math.min(1000, batchSize));
        this.lookbackHours = Math.max(1, Math.min(168, lookbackHours));
    }

    @Scheduled(fixedDelayString = "${app.kafka.outbox.poll-delay-ms:1000}")
    public synchronized void publishPending() {
        pollReportShard();
        Instant now = Instant.now();
        int remaining = batchSize;
        for (int offset = 0; offset < lookbackHours && remaining > 0; offset++) {
            String partition = PARTITION.format(now.minusSeconds(offset * 3600L));
            var events = outbox.findPending(partition, remaining);
            publishBatch(events);
            remaining -= events.size();
        }
    }

    private void pollReportShard() {
        int shard = reportShard;
        reportShard = (reportShard + 1) % reportCursors.length;
        try {
            var page = outbox.findReportPending(ReportOutboxRoute.partition(shard), reportCursors[shard],
                    Math.min(25, batchSize));
            reportCursors[shard] = page.lastScanned();
            publishBatch(page.events());
        } catch (RuntimeException failure) {
            LOG.warn("Report outbox poll retained work ({})", failure.getClass().getSimpleName());
        }
    }

    /** Recover exact legacy keys. Serialize with the hourly poll on this instance. */
    public synchronized List<UUID> publishLegacyReports(List<UUID> decisionIds) {
        if (decisionIds.size() > 25) throw new IllegalArgumentException("legacy report batch exceeds work page size");
        var events = new ArrayList<OutboxEvent>();
        for (UUID decisionId : decisionIds) {
            OutboxEvent event = outbox.findLegacyReportPending(decisionId);
            if (event != null) events.add(event);
        }
        return publishBatch(events);
    }

    private List<UUID> publishBatch(List<OutboxEvent> events) {
        if (events.isEmpty()) return List.of();
        List<Boolean> results = eventPublisher.publishBatch(events.stream().map(this::toDomainEvent).toList());
        if (results.size() != events.size()) {
            throw new IllegalStateException("event publisher returned a result count that does not match the batch");
        }
        var acknowledged = new ArrayList<UUID>();
        for (int index = 0; index < events.size(); index++) {
            OutboxEvent event = events.get(index);
            boolean published = Boolean.TRUE.equals(results.get(index));
            outbox.recordPublishAttempt(event, published ? Instant.now() : null);
            if (published) acknowledged.add(event.eventId());
        }
        return acknowledged;
    }

    private DomainEvent toDomainEvent(OutboxEvent event) {
        return new DomainEvent(
                event.eventId(),
                event.aggregateType(),
                event.aggregateId(),
                event.eventType(),
                event.payloadJson(),
                event.publishAttempts() + 1);
    }
}
