package com.chatapp.chat_service.canonical.messaging;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.UUID;

@Repository
public class CassandraOutboxRepository implements OutboxRepository {
    private final CqlSession session;
    private final PreparedStatement saveEvent;
    private final PreparedStatement savePending;
    private final PreparedStatement findPending;
    private final PreparedStatement findPendingAfter;
    private final PreparedStatement markEvent;
    private final PreparedStatement deletePending;
    private final PreparedStatement reportReceipt;
    private final PreparedStatement pageReceipts;
    private final PreparedStatement markFailure;

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
                SELECT event_id
                FROM outbox_pending_events_by_partition WHERE outbox_partition = ? LIMIT ?
                """);
        this.findPendingAfter = session.prepare("""
                SELECT event_id
                FROM outbox_pending_events_by_partition
                WHERE outbox_partition = ? AND event_id > ? LIMIT ?
                """);
        this.markEvent = session.prepare("""
                UPDATE outbox_events_by_partition SET published_at = ?, publish_attempts = ?
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.deletePending = session.prepare("""
                DELETE FROM outbox_pending_events_by_partition WHERE outbox_partition = ? AND event_id = ?
                """);
        this.reportReceipt = session.prepare("""
                SELECT published_at, publish_attempts FROM outbox_events_by_partition
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.pageReceipts = session.prepare("""
                SELECT event_id, published_at, publish_attempts, aggregate_type, aggregate_id, event_type,
                       payload_json, created_at
                FROM outbox_events_by_partition
                WHERE outbox_partition = ? AND event_id IN ?
                """);
        this.markFailure = session.prepare("""
                UPDATE outbox_events_by_partition SET publish_attempts = ?
                WHERE outbox_partition = ? AND event_id = ?
                """);
    }

    @Override
    public void enqueue(OutboxEvent event) {
        boolean replaySafeReport = isReportDecision(event) || ("REPORT_CREATED".equals(event.eventType())
                && "report".equals(event.aggregateType())
                && event.eventPartition().startsWith(ReportOutboxRoute.PARTITION_PREFIX)
                && ReportOutboxRoute.partition(UUID.fromString(event.aggregateId())).equals(event.eventPartition()));
        if (replaySafeReport && hasReceipt(reportReceipt(event))) return;
        var batch = BatchStatement.builder(BatchType.LOGGED)
                .addStatement(saveEvent.bind(
                        event.eventPartition(), event.eventId(), event.aggregateType(), event.aggregateId(),
                        event.eventType(), event.payloadJson(), event.createdAt()))
                .addStatement(savePending.bind(
                        event.eventPartition(), event.eventId(), event.aggregateType(), event.aggregateId(),
                        event.eventType(), event.payloadJson(), event.createdAt()))
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        if (replaySafeReport) {
            // Seed writes must never outrank a publish receipt or pending deletion.
            batch.setQueryTimestamp(1L);
        }
        session.execute(batch.build());
    }

    @Override
    public List<OutboxEvent> findPending(String partition, int limit) {
        var query = findPending.bind(partition, Math.max(1, Math.min(1_000, limit)));
        return eligible(partition, readPendingIds(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)));
    }

    @Override
    public ReportPendingPage findReportPending(String partition, UUID after, int limit) {
        int bounded = Math.max(1, Math.min(1_000, limit));
        var query = after == null ? findPending.bind(partition, bounded)
                : findPendingAfter.bind(partition, after, bounded);
        var pending = readPendingIds(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM));
        UUID cursor = pending.isEmpty() ? null : pending.get(pending.size() - 1);
        return new ReportPendingPage(eligible(partition, pending), cursor);
    }

    private List<UUID> readPendingIds(BoundStatement query) {
        return session.execute(query).all().stream().map(row -> row.getUuid("event_id")).toList();
    }

    private List<OutboxEvent> eligible(String partition, List<UUID> pending) {
        if (pending.isEmpty()) return List.of();
        var receipts = new HashMap<UUID, Row>();
        var query = pageReceipts.bind(partition, pending).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        for (Row receipt : session.execute(query).all()) {
            receipts.put(receipt.getUuid("event_id"), receipt);
        }
        List<OutboxEvent> eligible = new ArrayList<>(pending.size());
        for (UUID id : pending) {
            Row receipt = receipts.get(id);
            if (receipt == null) continue; // Pending can become visible before the authority row.
            if (hasReceipt(receipt)) {
                session.execute(deletePending.bind(partition, id)
                        .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM));
                continue;
            }
            eligible.add(pendingEvent(partition, id, receipt));
        }
        return List.copyOf(eligible);
    }

    @Override
    public OutboxEvent findLegacyReportPending(UUID decisionId) {
        String partition = ReportOutboxRoute.legacyPartition(decisionId);
        var query = pageReceipts.bind(partition, List.of(decisionId)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        Row authority = session.execute(query).one();
        if (authority == null || hasReceipt(authority)) return null;
        var event = pendingEvent(partition, decisionId, authority);
        return isReportDecision(event) ? event : null;
    }

    private OutboxEvent pendingEvent(String partition, UUID id, Row authority) {
        return new OutboxEvent(partition, id, authority.getString("aggregate_type"), authority.getString("aggregate_id"),
                authority.getString("event_type"), authority.getString("payload_json"), authority.getInstant("created_at"), null,
                authority.getInt("publish_attempts"));
    }

    @Override
    public void recordPublishAttempt(OutboxEvent event, Instant publishedAt) {
        int attempts = event.publishAttempts() + 1;
        if (publishedAt == null) {
            // A late failure must leave a successful receipt and pending deletion intact.
            session.execute(markFailure.bind(attempts, event.eventPartition(), event.eventId())
                    .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM));
            return;
        }
        var batch = BatchStatement.builder(BatchType.LOGGED)
                .addStatement(markEvent.bind(publishedAt, attempts, event.eventPartition(), event.eventId()))
                .addStatement(deletePending.bind(event.eventPartition(), event.eventId()))
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        session.execute(batch.build());
    }

    private Row reportReceipt(OutboxEvent event) {
        return readReportReceipt(event.eventPartition(), event.eventId());
    }

    @Override
    public boolean hasReportReceipt(String partition, UUID eventId) {
        return hasReceipt(readReportReceipt(partition, eventId));
    }

    private Row readReportReceipt(String partition, UUID eventId) {
        return session.execute(reportReceipt.bind(partition, eventId)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
    }

    private static boolean hasReceipt(Row row) {
        return row != null && row.getInstant("published_at") != null;
    }

    private static boolean isReportDecision(OutboxEvent event) {
        return "REPORT_STATUS_UPDATE".equals(event.eventType());
    }
}
