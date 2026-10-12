package com.chatapp.chat_service.canonical.messaging;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public class CassandraOutboxRepository implements OutboxRepository {
    private final CqlSession session;
    private final PreparedStatement saveEvent;
    private final PreparedStatement savePending;
    private final PreparedStatement findPending;
    private final PreparedStatement markEvent;
    private final PreparedStatement markPending;
    private final PreparedStatement deletePending;

    public CassandraOutboxRepository(CqlSession session) {
        this.session = session;
        this.saveEvent = session.prepare("""
                INSERT INTO outbox_events_by_partition
                    (outbox_partition, event_id, aggregate_type, aggregate_id, event_type,
                     payload_json, created_at, publish_attempts)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                """);
        this.savePending = session.prepare("""
                INSERT INTO outbox_pending_events_by_partition
                    (outbox_partition, event_id, aggregate_type, aggregate_id, event_type,
                     payload_json, created_at, publish_attempts)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                """);
        this.findPending = session.prepare("""
                SELECT outbox_partition, event_id, aggregate_type, aggregate_id, event_type,
                       payload_json, created_at, publish_attempts
                FROM outbox_pending_events_by_partition WHERE outbox_partition = ? LIMIT ?
                """);
        this.markEvent = session.prepare("""
                UPDATE outbox_events_by_partition SET published_at = ?, publish_attempts = ?
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.markPending = session.prepare("""
                UPDATE outbox_pending_events_by_partition SET publish_attempts = ?
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.deletePending = session.prepare("""
                DELETE FROM outbox_pending_events_by_partition WHERE outbox_partition = ? AND event_id = ?
                """);
    }

    @Override
    public void enqueue(OutboxEvent event) {
        session.execute(BatchStatement.builder(BatchType.LOGGED)
                .addStatement(saveEvent.bind(
                        event.eventPartition(), event.eventId(), event.aggregateType(), event.aggregateId(),
                        event.eventType(), event.payloadJson(), event.createdAt()))
                .addStatement(savePending.bind(
                        event.eventPartition(), event.eventId(), event.aggregateType(), event.aggregateId(),
                        event.eventType(), event.payloadJson(), event.createdAt()))
                .build());
    }

    @Override
    public List<OutboxEvent> findPending(String partition, int limit) {
        return session.execute(findPending.bind(partition, Math.max(1, Math.min(1_000, limit))))
                .all().stream().map(row -> new OutboxEvent(
                        row.getString("outbox_partition"), row.getUuid("event_id"),
                        row.getString("aggregate_type"), row.getString("aggregate_id"),
                        row.getString("event_type"), row.getString("payload_json"),
                        row.getInstant("created_at"), null, row.getInt("publish_attempts")))
                .toList();
    }

    @Override
    public void recordPublishAttempt(OutboxEvent event, Instant publishedAt) {
        int attempts = event.publishAttempts() + 1;
        var batch = BatchStatement.builder(BatchType.LOGGED)
                .addStatement(markEvent.bind(publishedAt, attempts, event.eventPartition(), event.eventId()));
        batch.addStatement(publishedAt == null
                ? markPending.bind(attempts, event.eventPartition(), event.eventId())
                : deletePending.bind(event.eventPartition(), event.eventId()));
        session.execute(batch.build());
    }
}
