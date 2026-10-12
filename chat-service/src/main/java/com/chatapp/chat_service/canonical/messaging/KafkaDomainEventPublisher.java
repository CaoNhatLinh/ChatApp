package com.chatapp.chat_service.canonical.messaging;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Component
@ConditionalOnProperty(prefix = "app.integrations.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class KafkaDomainEventPublisher implements DomainEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(KafkaDomainEventPublisher.class);

    private final KafkaTemplate<String, String> kafka;
    private final String topic;
    private final Duration sendTimeout;

    public KafkaDomainEventPublisher(
            KafkaTemplate<String, String> kafka,
            @Value("${app.kafka.topics.domain-events}") String topic,
            @Value("${app.kafka.outbox.send-timeout:10s}") Duration sendTimeout) {
        this.kafka = kafka;
        this.topic = topic;
        this.sendTimeout = sendTimeout;
    }

    @Override
    public boolean publish(DomainEvent event) {
        return publishBatch(List.of(event)).get(0);
    }

    @Override
    public List<Boolean> publishBatch(List<DomainEvent> events) {
        List<CompletableFuture<Boolean>> sends = new ArrayList<>(events.size());
        for (DomainEvent event : events) {
            sends.add(send(event));
        }
        if (sends.isEmpty()) {
            return List.of();
        }
        try {
            CompletableFuture.allOf(sends.toArray(CompletableFuture[]::new))
                    .orTimeout(sendTimeout.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)
                    .join();
        } catch (RuntimeException exception) {
            log.warn("Timed out while waiting for an outbox publish batch acknowledgement", exception);
        }
        return sends.stream().map(send -> send.getNow(false)).toList();
    }

    private CompletableFuture<Boolean> send(DomainEvent event) {
        ProducerRecord<String, String> record = new ProducerRecord<>(
                topic, event.aggregateId(), event.payloadJson());
        addHeader(record, "eventId", event.eventId().toString());
        addHeader(record, "eventType", event.eventType());
        addHeader(record, "aggregateType", event.aggregateType());
        return kafka.send(record)
                .thenApply(result -> true)
                .exceptionally(exception -> {
                    log.warn("Outbox publish failed for event {} (attempt {})",
                            event.eventId(), event.publishAttempt(), exception);
                    return false;
                });
    }

    private void addHeader(ProducerRecord<String, String> record, String name, String value) {
        record.headers().add(name, value.getBytes(StandardCharsets.UTF_8));
    }
}
