package com.chatapp.chat_service.canonical.messaging;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OutboxRepository {
    void enqueue(OutboxEvent event);

    List<OutboxEvent> findPending(String partition, int limit);

    void recordPublishAttempt(OutboxEvent event, Instant publishedAt);

    record OutboxEvent(
            String eventPartition,
            UUID eventId,
            String aggregateType,
            String aggregateId,
            String eventType,
            String payloadJson,
            Instant createdAt,
            Instant publishedAt,
            int publishAttempts) {
    }
}
