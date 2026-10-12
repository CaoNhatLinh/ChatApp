package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.messaging.OutboxRepository.OutboxEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
@ConditionalOnProperty(prefix = "app.integrations.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class CassandraOutboxPublisher {
    private static final DateTimeFormatter PARTITION = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH")
            .withZone(ZoneOffset.UTC);

    private final OutboxRepository outbox;
    private final DomainEventPublisher eventPublisher;
    private final int batchSize;
    private final int lookbackHours;

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
    public void publishPending() {
        Instant now = Instant.now();
        int remaining = batchSize;
        for (int offset = 0; offset < lookbackHours && remaining > 0; offset++) {
            String partition = PARTITION.format(now.minusSeconds(offset * 3600L));
            var events = outbox.findPending(partition, remaining);
            if (events.isEmpty()) {
                continue;
            }
            List<Boolean> results = eventPublisher.publishBatch(events.stream().map(this::toDomainEvent).toList());
            if (results.size() != events.size()) {
                throw new IllegalStateException("event publisher returned a result count that does not match the batch");
            }
            for (int index = 0; index < events.size(); index++) {
                OutboxEvent event = events.get(index);
                if (Boolean.TRUE.equals(results.get(index))) {
                    outbox.recordPublishAttempt(event, Instant.now());
                } else {
                    outbox.recordPublishAttempt(event, null);
                }
                remaining--;
                if (remaining == 0) {
                    break;
                }
            }
        }
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
