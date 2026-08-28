package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore.OutboxEvent;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@Component
@ConditionalOnProperty(prefix = "app.integrations.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class CassandraOutboxPublisher {
    private static final Logger log = LoggerFactory.getLogger(CassandraOutboxPublisher.class);
    private static final DateTimeFormatter PARTITION = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH")
            .withZone(ZoneOffset.UTC);

    private final CanonicalCqlStore store;
    private final KafkaTemplate<String, String> kafka;
    private final String topic;
    private final int batchSize;
    private final int lookbackHours;
    private final Duration sendTimeout;

    public CassandraOutboxPublisher(
            CanonicalCqlStore store,
            KafkaTemplate<String, String> kafka,
            @Value("${app.kafka.topics.domain-events}") String topic,
            @Value("${app.kafka.outbox.batch-size:100}") int batchSize,
            @Value("${app.kafka.outbox.lookback-hours:24}") int lookbackHours,
            @Value("${app.kafka.outbox.send-timeout:10s}") Duration sendTimeout) {
        this.store = store;
        this.kafka = kafka;
        this.topic = topic;
        this.batchSize = Math.max(1, Math.min(1000, batchSize));
        this.lookbackHours = Math.max(1, Math.min(168, lookbackHours));
        this.sendTimeout = sendTimeout;
    }

    @Scheduled(fixedDelayString = "${app.kafka.outbox.poll-delay-ms:1000}")
    public void publishPending() {
        Instant now = Instant.now();
        int remaining = batchSize;
        for (int offset = 0; offset < lookbackHours && remaining > 0; offset++) {
            String partition = PARTITION.format(now.minusSeconds(offset * 3600L));
            var events = store.listUnpublishedOutboxEvents(partition, remaining);
            for (OutboxEvent event : events) {
                if (publish(event)) {
                    store.markOutboxPublishAttempt(event, Instant.now());
                } else {
                    store.markOutboxPublishAttempt(event, null);
                }
                remaining--;
                if (remaining == 0) {
                    break;
                }
            }
        }
    }

    private boolean publish(OutboxEvent event) {
        ProducerRecord<String, String> record = new ProducerRecord<>(
                topic, event.aggregateId(), event.payloadJson());
        addHeader(record, "eventId", event.eventId().toString());
        addHeader(record, "eventType", event.eventType());
        addHeader(record, "aggregateType", event.aggregateType());
        try {
            kafka.send(record).get(sendTimeout.toMillis(), TimeUnit.MILLISECONDS);
            return true;
        } catch (Exception exception) {
            log.warn("Outbox publish failed for event {} (attempt {})",
                    event.eventId(), event.publishAttempts() + 1, exception);
            return false;
        }
    }

    private void addHeader(ProducerRecord<String, String> record, String name, String value) {
        record.headers().add(name, value.getBytes(StandardCharsets.UTF_8));
    }
}
