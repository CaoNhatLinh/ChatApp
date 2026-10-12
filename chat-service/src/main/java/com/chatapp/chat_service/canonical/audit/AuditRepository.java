package com.chatapp.chat_service.canonical.audit;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomEvent;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AuditRepository {
    void saveRoomEvent(CanonicalRoomAuditEvent event);

    List<CanonicalRoomEvent> findRoomEvents(
            UUID conversationId, String eventMonth, UUID beforeEventId, int limit);

    void saveAuditEvent(CanonicalRoomAuditEvent event);

    List<AuditEvent> findAuditEvents(String eventMonth, int limit);

    record AuditEvent(
            String eventMonth,
            UUID eventId,
            String action,
            String resourceType,
            String resourceId,
            UUID actorId,
            UUID conversationId,
            UUID targetUserId,
            String outcome,
            String reasonCode,
            Map<String, String> beforeState,
            Map<String, String> afterState,
            UUID requestId,
            Instant createdAt) {
    }
}
