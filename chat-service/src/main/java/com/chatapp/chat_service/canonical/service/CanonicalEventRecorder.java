package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.analytics.AnalyticsRepository;
import com.chatapp.chat_service.canonical.audit.AuditRepository;
import com.chatapp.chat_service.canonical.messaging.OutboxRepository;
import com.chatapp.chat_service.canonical.messaging.ReportOutboxRoute;
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
        return record(Uuids.timeBased(), Instant.now(), actorId, conversationId, action, resourceType,
                resourceId, targetUserId, reasonCode, beforeState, afterState, domainPayload);
    }

    /**
     * Publishes a newly committed event whose identity was persisted with the decision.
     * Report decisions use the versioned report route, not hourly lookback.
     */
    public UUID recordWithIdentity(
            UUID eventId, UUID actorId, UUID conversationId, String action, String resourceType,
            String resourceId, UUID targetUserId, String reasonCode,
            Map<String, String> beforeState, Map<String, String> afterState) {
        Instant occurredAt = Instant.ofEpochMilli(Uuids.unixTimestamp(eventId));
        return record(eventId, occurredAt, actorId, conversationId, action, resourceType,
                resourceId, targetUserId, reasonCode, beforeState, afterState, null);
    }

    private UUID record(
            UUID eventId, Instant now, UUID actorId, UUID conversationId, String action, String resourceType,
            String resourceId, UUID targetUserId, String reasonCode, Map<String, String> beforeState,
            Map<String, String> afterState, Map<String, Object> domainPayload) {
        if (!StringUtils.hasText(resourceId)) {
            throw new IllegalArgumentException("canonical audit resourceId is required");
        }
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
        String partition = "REPORT_STATUS_UPDATE".equals(action)
                ? ReportOutboxRoute.partition(UUID.fromString(canonicalResourceId)) : OUTBOX_PARTITION.format(now);
        outbox.enqueue(new OutboxRepository.OutboxEvent(
                partition, eventId, resourceType, canonicalResourceId, action,
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

    /** Rebuilds the immutable creation event from a persisted keyed report. */
    public void recoverReportCreation(UUID eventId, UUID reportId, UUID reporterId, UUID conversationId,
                                      UUID targetUserId, String reasonCode, String targetType) {
        Instant createdAt = Instant.ofEpochMilli(Uuids.unixTimestamp(eventId));
        String resourceId = reportId.toString();
        var auditEvent = new CanonicalRoomAuditEvent(reporterId, MONTH.format(createdAt), eventId,
                "REPORT_CREATED", "report", resourceId, conversationId, targetUserId,
                "SUCCESS", reasonCode, Map.of(), Map.of("status", "OPEN"), null, null, null, createdAt);
        if (conversationId != null) audit.saveRoomEvent(auditEvent);
        audit.saveAuditEvent(auditEvent);
        var domain = new DomainEvent(eventId, "REPORT_CREATED", "report", resourceId, conversationId,
                reporterId, createdAt, Map.of("targetType", targetType));
        outbox.enqueue(new OutboxRepository.OutboxEvent(ReportOutboxRoute.partition(reportId), eventId,
                "report", resourceId, "REPORT_CREATED", toJson(domain), createdAt, null, 0));
    }

    /** Rebuilds only the audit projections; never enqueues or emits analytics. */
    public void restoreReportAudit(CanonicalRoomAuditEvent event) {
        if (!"REPORT_STATUS_UPDATE".equals(event.action()) || !"report".equals(event.resourceType())) {
            throw new IllegalArgumentException("expected report decision audit");
        }
        if (event.conversationId() != null) audit.saveRoomEvent(event);
        audit.saveAuditEvent(event);
    }

    /** The caller must verify the persisted routing version before invoking this. */
    public void enqueueRecoveredReport(CanonicalRoomAuditEvent event) {
        enqueueRecoveredReport(event, ReportOutboxRoute.partition(UUID.fromString(event.resourceId())));
    }

    /** The caller must verify that the persisted intent predates versioned routing. */
    public void enqueueLegacyRecoveredReport(CanonicalRoomAuditEvent event) {
        enqueueRecoveredReport(event, ReportOutboxRoute.legacyPartition(event.eventId()));
    }

    private void enqueueRecoveredReport(CanonicalRoomAuditEvent event, String partition) {
        if (!"REPORT_STATUS_UPDATE".equals(event.action()) || !"report".equals(event.resourceType())) {
            throw new IllegalArgumentException("expected report decision event");
        }
        outbox.enqueue(new OutboxRepository.OutboxEvent(partition, event.eventId(), event.resourceType(),
                event.resourceId(), event.action(), toJson(event), event.createdAt(), null, 0));
    }

    public boolean hasLegacyReportReceipt(UUID decisionId) {
        return outbox.hasReportReceipt(ReportOutboxRoute.legacyPartition(decisionId), decisionId);
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
