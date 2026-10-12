package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.analytics.AnalyticsRepository;
import com.chatapp.chat_service.canonical.audit.AuditRepository;
import com.chatapp.chat_service.canonical.messaging.OutboxRepository;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;

@Service
public class CanonicalEventRecorder {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter OUTBOX_PARTITION = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH").withZone(ZoneOffset.UTC);

    private final AuditRepository audit;
    private final AnalyticsRepository analytics;
    private final OutboxRepository outbox;
    private final ObjectMapper objectMapper;

    public CanonicalEventRecorder(
            AuditRepository audit,
            AnalyticsRepository analytics,
            OutboxRepository outbox,
            ObjectMapper objectMapper) {
        this.audit = audit;
        this.analytics = analytics;
        this.outbox = outbox;
        this.objectMapper = objectMapper;
    }

    public UUID record(
            UUID actorId,
            UUID conversationId,
            String action,
            String resourceType,
            String resourceId,
            UUID targetUserId,
            String reasonCode,
            Map<String, String> beforeState,
            Map<String, String> afterState) {
        return record(actorId, conversationId, action, resourceType, resourceId, targetUserId,
                reasonCode, beforeState, afterState, null);
    }

    public UUID record(
            UUID actorId,
            UUID conversationId,
            String action,
            String resourceType,
            String resourceId,
            UUID targetUserId,
            String reasonCode,
            Map<String, String> beforeState,
            Map<String, String> afterState,
            Map<String, Object> domainPayload) {
        if (!StringUtils.hasText(resourceId)) {
            throw new IllegalArgumentException("canonical audit resourceId is required");
        }
        Instant now = Instant.now();
        UUID eventId = Uuids.timeBased();
        String canonicalResourceId = resourceId.trim();
        CanonicalRoomAuditEvent event = new CanonicalRoomAuditEvent(
                actorId,
                MONTH.format(now),
                eventId,
                action,
                resourceType,
                canonicalResourceId,
                conversationId,
                targetUserId,
                "SUCCESS",
                reasonCode,
                beforeState,
                afterState,
                null,
                null,
                null,
                now);

        if (conversationId != null) {
            audit.saveRoomEvent(event);
            analytics.record(event);
        }
        audit.saveAuditEvent(event);
        outbox.enqueue(new OutboxRepository.OutboxEvent(
                OUTBOX_PARTITION.format(now), eventId, resourceType, canonicalResourceId, action,
                domainPayload == null ? toJson(event) : toJson(new DomainEvent(
                        eventId, action, resourceType, canonicalResourceId,
                        conversationId, actorId, now, domainPayload)),
                now, null, 0));
        return eventId;
    }

    private String toJson(Object event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize canonical event", exception);
        }
    }

    public record DomainEvent(
            UUID eventId,
            String eventType,
            String aggregateType,
            String aggregateId,
            UUID conversationId,
            UUID actorId,
            Instant occurredAt,
            Map<String, Object> payload) {
    }
}
