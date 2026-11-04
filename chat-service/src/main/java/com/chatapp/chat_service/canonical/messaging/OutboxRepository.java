package com.chatapp.chat_service.canonical.messaging;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OutboxRepository {
    void enqueue(OutboxEvent event);

    List<OutboxEvent> findPending(String partition, int limit);
    ReportPendingPage findReportPending(String partition, UUID after, int limit);
    boolean hasReportReceipt(String partition, UUID eventId);
    OutboxEvent findLegacyReportPending(UUID decisionId);

    void recordPublishAttempt(OutboxEvent event, Instant publishedAt);

    record ReportPendingPage(List<OutboxEvent> events, UUID lastScanned) {}

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
