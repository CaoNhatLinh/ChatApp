package com.chatapp.chat_service.canonical.audit;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomEvent;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class CassandraAuditRepository implements AuditRepository {
    private final CqlSession session;
    private final PreparedStatement saveRoomEvent;
    private final PreparedStatement findRoomEvents;
    private final PreparedStatement findRoomEventsBefore;
    private final PreparedStatement saveAuditByActor;
    private final PreparedStatement saveAuditByResource;
    private final PreparedStatement saveAuditByMonth;
    private final PreparedStatement findAuditByMonth;

    public CassandraAuditRepository(CqlSession session) {
        this.session = session;
        this.saveRoomEvent = session.prepare("""
                INSERT INTO room_events_by_conversation
                    (conversation_id, event_month, event_id, event_type, actor_id, target_user_id,
                     message_bucket, message_id, reason_code, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.findRoomEvents = session.prepare("""
                SELECT conversation_id, event_month, event_id, event_type, actor_id, target_user_id,
                       message_bucket, message_id, reason_code, metadata, created_at
                FROM room_events_by_conversation
                WHERE conversation_id = ? AND event_month = ? LIMIT ?
                """);
        this.findRoomEventsBefore = session.prepare("""
                SELECT conversation_id, event_month, event_id, event_type, actor_id, target_user_id,
                       message_bucket, message_id, reason_code, metadata, created_at
                FROM room_events_by_conversation
                WHERE conversation_id = ? AND event_month = ? AND event_id < ? LIMIT ?
                """);
        this.saveAuditByActor = session.prepare("""
                INSERT INTO audit_events_by_actor
                    (actor_id, event_month, event_id, action, resource_type, resource_id,
                     conversation_id, target_user_id, outcome, reason_code, before_state,
                     after_state, request_id, ip_hash, user_agent_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.saveAuditByResource = session.prepare("""
                INSERT INTO audit_events_by_resource
                    (resource_type, resource_id, event_month, event_id, actor_id, action, outcome, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.saveAuditByMonth = session.prepare("""
                INSERT INTO audit_events_by_month
                    (event_month, event_id, action, resource_type, resource_id, actor_id,
                     conversation_id, target_user_id, outcome, reason_code, before_state,
                     after_state, request_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.findAuditByMonth = session.prepare("""
                SELECT event_month, event_id, action, resource_type, resource_id, actor_id,
                       conversation_id, target_user_id, outcome, reason_code, before_state,
                       after_state, request_id, created_at
                FROM audit_events_by_month WHERE event_month = ? LIMIT ?
                """);
    }

    @Override
    public void saveRoomEvent(CanonicalRoomAuditEvent event) {
        session.execute(saveRoomEvent.bind(
                event.conversationId(), event.eventMonth(), event.eventId(), event.action(), event.actorId(),
                event.targetUserId(), null, null, event.reasonCode(), metadata(event), event.createdAt()));
    }

    @Override
    public List<CanonicalRoomEvent> findRoomEvents(
            UUID conversationId, String eventMonth, UUID beforeEventId, int limit) {
        var statement = beforeEventId == null
                ? findRoomEvents.bind(conversationId, eventMonth, limit)
                : findRoomEventsBefore.bind(conversationId, eventMonth, beforeEventId, limit);
        return session.execute(statement).all().stream().map(row -> new CanonicalRoomEvent(
                row.getUuid("conversation_id"), row.getString("event_month"), row.getUuid("event_id"),
                row.getString("event_type"), row.getUuid("actor_id"), row.getUuid("target_user_id"),
                row.getString("message_bucket"), row.getUuid("message_id"), row.getString("reason_code"),
                row.getMap("metadata", String.class, String.class), row.getInstant("created_at"))).toList();
    }

    @Override
    public void saveAuditEvent(CanonicalRoomAuditEvent event) {
        session.execute(saveAuditByActor.bind(
                event.actorId(), event.eventMonth(), event.eventId(), event.action(), event.resourceType(),
                event.resourceId(), event.conversationId(), event.targetUserId(), event.outcome(),
                event.reasonCode(), event.beforeState(), event.afterState(), event.requestId(), event.ipHash(),
                event.userAgentHash(), event.createdAt()));
        session.execute(saveAuditByResource.bind(
                event.resourceType(), event.resourceId(), event.eventMonth(), event.eventId(), event.actorId(),
                event.action(), event.outcome(), event.createdAt()));
        session.execute(saveAuditByMonth.bind(
                event.eventMonth(), event.eventId(), event.action(), event.resourceType(), event.resourceId(),
                event.actorId(), event.conversationId(), event.targetUserId(), event.outcome(), event.reasonCode(),
                event.beforeState(), event.afterState(), event.requestId(), event.createdAt()));
    }

    @Override
    public List<AuditEvent> findAuditEvents(String eventMonth, int limit) {
        return session.execute(findAuditByMonth.bind(eventMonth, Math.max(1, Math.min(limit, 200))))
                .all().stream().map(row -> new AuditEvent(
                        row.getString("event_month"), row.getUuid("event_id"), row.getString("action"),
                        row.getString("resource_type"), row.getString("resource_id"), row.getUuid("actor_id"),
                        row.getUuid("conversation_id"), row.getUuid("target_user_id"), row.getString("outcome"),
                        row.getString("reason_code"), row.getMap("before_state", String.class, String.class),
                        row.getMap("after_state", String.class, String.class), row.getUuid("request_id"),
                        row.getInstant("created_at"))).toList();
    }

    private Map<String, String> metadata(CanonicalRoomAuditEvent event) {
        Map<String, String> values = new LinkedHashMap<>();
        if (event.beforeState() != null) event.beforeState().forEach((key, value) -> values.put("before." + key, value));
        if (event.afterState() != null) event.afterState().forEach((key, value) -> values.put("after." + key, value));
        return Map.copyOf(values);
    }
}
