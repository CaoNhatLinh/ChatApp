package com.chatapp.chat_service.canonical.analytics;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Repository
public class CassandraAnalyticsRepository implements AnalyticsRepository {
    private static final String[] EVENT_TYPES = {
            "ROOM_CREATED", "ROOM_JOINED", "MESSAGE_SENT", "POLLS_CREATED", "POLL_VOTED", "CALL_STARTED"
    };
    private final CqlSession session;
    private final PreparedStatement save;
    private final PreparedStatement findByType;

    public CassandraAnalyticsRepository(CqlSession session) {
        this.session = session;
        this.save = session.prepare("""
                INSERT INTO analytics_events_by_day_type
                    (event_day, event_type, event_shard, occurred_at, event_id, actor_id, conversation_id, dimensions)
                VALUES (?, ?, ?, now(), ?, ?, ?, ?)
                """);
        this.findByType = session.prepare("""
                SELECT event_day, event_type, event_shard, event_id, actor_id, conversation_id, dimensions
                FROM analytics_events_by_day_type
                WHERE event_day = ? AND event_type = ? AND event_shard = ? LIMIT ?
                """);
    }

    @Override
    public void record(CanonicalRoomAuditEvent event) {
        String type = eventType(event.action());
        if (type == null) return;
        session.execute(save.bind(
                event.createdAt().atZone(ZoneOffset.UTC).toLocalDate(), type,
                (byte) Math.floorMod((event.actorId() == null ? event.eventId() : event.actorId()).hashCode(), 16),
                event.eventId(), event.actorId(), event.conversationId(),
                event.beforeState() == null ? Map.of() : event.beforeState()));
    }

    @Override
    public List<CanonicalAnalyticsPoint> find(LocalDate day, String eventType, int limit) {
        int bounded = Math.max(1, Math.min(2_000, limit));
        String[] types = "ALL".equalsIgnoreCase(eventType) ? EVENT_TYPES : new String[]{eventType};
        List<CanonicalAnalyticsPoint> points = new ArrayList<>();
        for (String type : types) {
            for (int shard = 0; shard < 16 && points.size() < bounded; shard++) {
                int remaining = bounded - points.size();
                points.addAll(session.execute(findByType.bind(day, type, (byte) shard, remaining)).all().stream()
                        .map(row -> new CanonicalAnalyticsPoint(
                                row.getLocalDate("event_day"), row.getString("event_type"),
                                (int) row.getByte("event_shard"), row.getUuid("event_id"),
                                row.getUuid("actor_id"), row.getUuid("conversation_id"),
                                row.getMap("dimensions", String.class, String.class)))
                        .toList());
            }
        }
        return points.stream().limit(bounded).toList();
    }

    private String eventType(String action) {
        return switch (action) {
            case "CONVERSATION_CREATE" -> "ROOM_CREATED";
            case "JOIN_BY_INVITE", "JOIN_REQUEST_APPROVE" -> "ROOM_JOINED";
            case "MESSAGE_SEND" -> "MESSAGE_SENT";
            case "POLL_CREATE" -> "POLLS_CREATED";
            case "POLL_VOTE", "POLL_VOTE_CHANGE" -> "POLL_VOTED";
            case "CALL_START" -> "CALL_STARTED";
            default -> null;
        };
    }
}
