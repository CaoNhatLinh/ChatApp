package com.chatapp.chat_service.canonical.messaging;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class CassandraReportOutboxRecoveryTest {
    private static final Instant DECIDED_AT = Instant.parse("2025-12-31T23:59:59Z");
    private static final UUID EVENT_ID = Uuids.startOf(DECIDED_AT.toEpochMilli());
    private static final String PARTITION = "report-04";
    private static final String PAYLOAD = "{\"reason\":\"checked evidence\"}";
    private final CqlSession session = mock(CqlSession.class);
    private final PreparedStatement publicationRead = mock(PreparedStatement.class);
    private final PreparedStatement pageReceipts = mock(PreparedStatement.class);
    private final PreparedStatement eventInsert = mock(PreparedStatement.class);
    private final PreparedStatement pendingInsert = mock(PreparedStatement.class);
    private final PreparedStatement pendingRead = mock(PreparedStatement.class);
    private final PreparedStatement pendingDelete = mock(PreparedStatement.class);
    private final PreparedStatement markFailure = mock(PreparedStatement.class);
    private final PreparedStatement markPublished = mock(PreparedStatement.class);
    private final BoundStatement read = mock(BoundStatement.class, RETURNS_SELF);
    private final BoundStatement eventWrite = mock(BoundStatement.class);
    private final BoundStatement pendingWrite = mock(BoundStatement.class);
    private final CassandraOutboxRepository repository;

    CassandraReportOutboxRecoveryTest() {
        var other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            if (query.contains("SELECT published_at, publish_attempts FROM outbox_events_by_partition")
                    && query.contains("WHERE outbox_partition = ? AND event_id = ?")) return publicationRead;
            if (query.contains("SELECT event_id, published_at, publish_attempts")
                    && query.contains("FROM outbox_events_by_partition")) return pageReceipts;
            if (query.contains("INSERT INTO outbox_events_by_partition")) return eventInsert;
            if (query.contains("INSERT INTO outbox_pending_events_by_partition")) return pendingInsert;
            if (query.contains("FROM outbox_pending_events_by_partition") && query.contains("LIMIT")) return pendingRead;
            if (query.contains("DELETE FROM outbox_pending_events_by_partition")) return pendingDelete;
            if (query.contains("UPDATE outbox_events_by_partition SET publish_attempts = ?")) return markFailure;
            if (query.contains("UPDATE outbox_events_by_partition SET published_at = ?, publish_attempts = ?")) return markPublished;
            return other;
        });
        repository = new CassandraOutboxRepository(session);
    }

    @Test
    void acknowledgedReportDoesNotReinsertPendingRow() {
        var row = mock(Row.class);
        when(row.getInstant("published_at")).thenReturn(DECIDED_AT.plusSeconds(1));
        stubPublicationRead(row);

        repository.enqueue(event("REPORT_STATUS_UPDATE"));

        verify(publicationRead).bind(PARTITION, EVENT_ID);
        verify(read).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(session, never()).execute(any(BatchStatement.class));
        verifyNoInteractions(eventInsert, pendingInsert);
    }

    @Test
    void missingOrUnacknowledgedReportReusesExactSeedTimestampAndIdentity() {
        stubPublicationRead(null, mock(Row.class));
        var report = event("REPORT_STATUS_UPDATE");
        stubInserts(report);

        repository.enqueue(report);
        repository.enqueue(report);

        var batches = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session, times(2)).execute(batches.capture());
        assertThat(batches.getAllValues()).allSatisfy(batch -> {
            assertThat(batch.getBatchType()).isEqualTo(BatchType.LOGGED);
            assertThat(batch.getQueryTimestamp()).isEqualTo(1L);
            assertThat(batch.getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
            assertThat(batch).containsExactly(eventWrite, pendingWrite);
        });
        verify(eventInsert, times(2)).bind(PARTITION, EVENT_ID, "report", "report-1",
                "REPORT_STATUS_UPDATE", PAYLOAD, DECIDED_AT);
        verify(pendingInsert, times(2)).bind(PARTITION, EVENT_ID, "report", "report-1",
                "REPORT_STATUS_UPDATE", PAYLOAD, DECIDED_AT);
    }

    @Test
    void keyedReportCreationHonorsExistingPublicationReceipt() {
        UUID reportId = UUID.randomUUID();
        String partition = ReportOutboxRoute.partition(reportId);
        var confirmed = mock(Row.class);
        when(confirmed.getInstant("published_at")).thenReturn(DECIDED_AT.plusSeconds(1));
        var result = mock(ResultSet.class);
        when(publicationRead.bind(partition, EVENT_ID)).thenReturn(read);
        when(session.execute(read)).thenReturn(result);
        when(result.one()).thenReturn(confirmed);

        repository.enqueue(new OutboxRepository.OutboxEvent(partition, EVENT_ID, "report", reportId.toString(),
                "REPORT_CREATED", PAYLOAD, DECIDED_AT, null, 0));

        verify(read).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(session, never()).execute(any(BatchStatement.class));
    }

    @Test
    void ordinaryOutboxEnqueueDoesNotReadPublicationOrUseReportTimestamp() {
        var ordinary = event("REPORT_CREATED");
        stubInserts(ordinary);

        repository.enqueue(ordinary);

        verifyNoInteractions(publicationRead);
        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(batch.capture());
        assertThat(batch.getValue().getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(batch.getValue().getQueryTimestamp()).isNotEqualTo(1L);
        assertThat(batch.getValue()).containsExactly(eventWrite, pendingWrite);
    }

    @ParameterizedTest
    @ValueSource(strings = {"REPORT_STATUS_UPDATE", "MESSAGE_SEND"})
    void publisherLookupCleansAcknowledgedRowsAndUsesAuthorityAttemptsForRemainingWork(String type) {
        UUID nextId = Uuids.startOf(DECIDED_AT.plusSeconds(1).toEpochMilli());
        UUID uncommittedId = Uuids.startOf(DECIDED_AT.plusSeconds(2).toEpochMilli());
        stubPage(pendingRead, PARTITION, 25, List.of(pending(EVENT_ID), pending(nextId), pending(uncommittedId)));
        var confirmed = mock(Row.class);
        when(confirmed.getUuid("event_id")).thenReturn(EVENT_ID);
        when(confirmed.getInstant("published_at")).thenReturn(DECIDED_AT.plusSeconds(1));
        var next = mock(Row.class);
        when(next.getUuid("event_id")).thenReturn(nextId);
        when(next.getInt("publish_attempts")).thenReturn(3);
        when(next.getString("event_type")).thenReturn(type);
        when(next.getString("aggregate_type")).thenReturn("message");
        when(next.getString("aggregate_id")).thenReturn("message-1");
        when(next.getString("payload_json")).thenReturn(PAYLOAD);
        when(next.getInstant("created_at")).thenReturn(DECIDED_AT);
        var receiptQuery = stubPage(pageReceipts, PARTITION, List.of(EVENT_ID, nextId, uncommittedId), List.of(confirmed, next));
        var delete = mock(BoundStatement.class, RETURNS_SELF);
        when(pendingDelete.bind(PARTITION, EVENT_ID)).thenReturn(delete);

        assertThat(repository.findPending(PARTITION, 25)).singleElement().satisfies(event -> {
            assertThat(event.eventId()).isEqualTo(nextId);
            assertThat(event.publishAttempts()).isEqualTo(3);
            assertThat(event.eventType()).isEqualTo(type);
            assertThat(event.aggregateType()).isEqualTo("message");
            assertThat(event.aggregateId()).isEqualTo("message-1");
            assertThat(event.payloadJson()).isEqualTo(PAYLOAD);
            assertThat(event.createdAt()).isEqualTo(DECIDED_AT);
        });
        verify(receiptQuery).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(delete).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(session).execute(delete);
    }

    @Test
    void reportScanAdvancesPastPendingPointerBeforeAuthorityAppears() {
        stubPage(pendingRead, PARTITION, 25, List.of(pending(EVENT_ID)));
        stubPage(pageReceipts, PARTITION, List.of(EVENT_ID), List.of());

        var page = repository.findReportPending(PARTITION, null, 25);

        assertThat(page.events()).isEmpty();
        assertThat(page.lastScanned()).isEqualTo(EVENT_ID);
        verifyNoInteractions(pendingDelete);
    }

    @Test
    void exactLegacyReadUsesOriginalHourAndSkipsDurableAcknowledgement() {
        String oldHour = "2025-12-31-23";
        var row = mock(Row.class);
        when(row.getString("event_type")).thenReturn("REPORT_STATUS_UPDATE");
        when(row.getString("payload_json")).thenReturn(PAYLOAD);
        when(row.getInt("publish_attempts")).thenReturn(4);
        when(row.getInstant("published_at")).thenReturn(null, DECIDED_AT.plusSeconds(1));
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(pageReceipts.bind(oldHour, List.of(EVENT_ID))).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        when(result.one()).thenReturn(row);

        var pending = repository.findLegacyReportPending(EVENT_ID);

        assertThat(pending.eventPartition()).isEqualTo(oldHour);
        assertThat(pending.eventId()).isEqualTo(EVENT_ID);
        assertThat(pending.payloadJson()).isEqualTo(PAYLOAD);
        assertThat(pending.publishAttempts()).isEqualTo(4);
        assertThat(repository.findLegacyReportPending(EVENT_ID)).isNull();
        verify(query, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verifyNoInteractions(pendingRead);
    }

    @ParameterizedTest
    @ValueSource(strings = {"REPORT_STATUS_UPDATE", "MESSAGE_SEND"})
    void failureAfterSuccessfulSendCannotOverwriteReceiptOrReinsertPending(String type) {
        var confirmedAt = DECIDED_AT.plusSeconds(1);
        var receiptWrite = mock(BoundStatement.class);
        var delete = mock(BoundStatement.class);
        var update = mock(BoundStatement.class, RETURNS_SELF);
        when(markPublished.bind(confirmedAt, 1, PARTITION, EVENT_ID)).thenReturn(receiptWrite);
        when(pendingDelete.bind(PARTITION, EVENT_ID)).thenReturn(delete);
        when(markFailure.bind(1, PARTITION, EVENT_ID)).thenReturn(update);

        repository.recordPublishAttempt(event(type), confirmedAt);
        repository.recordPublishAttempt(event(type), null);

        var success = ArgumentCaptor.forClass(BatchStatement.class);
        var writes = inOrder(session);
        writes.verify(session).execute(success.capture());
        writes.verify(session).execute(update);
        assertThat(success.getValue().getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        assertThat(success.getValue()).containsExactly(receiptWrite, delete);
        verify(markPublished).bind(confirmedAt, 1, PARTITION, EVENT_ID);
        verify(pendingDelete).bind(PARTITION, EVENT_ID);
        verify(markFailure).bind(1, PARTITION, EVENT_ID);
        verify(update).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verifyNoMoreInteractions(markPublished, markFailure, pendingDelete);
        verifyNoInteractions(pendingInsert);
    }

    private Row pending(UUID id) {
        var pending = mock(Row.class);
        when(pending.getUuid("event_id")).thenReturn(id);
        return pending;
    }

    private BoundStatement stubPage(PreparedStatement statement, String partition, Object key, List<Row> rows) {
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(statement.bind(partition, key)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        when(result.all()).thenReturn(rows);
        return query;
    }

    private void stubPublicationRead(Row first, Row... rest) {
        var result = mock(ResultSet.class);
        when(publicationRead.bind(PARTITION, EVENT_ID)).thenReturn(read);
        when(session.execute(read)).thenReturn(result);
        when(result.one()).thenReturn(first, rest);
    }

    private void stubInserts(OutboxRepository.OutboxEvent event) {
        when(eventInsert.bind(PARTITION, EVENT_ID, event.aggregateType(), event.aggregateId(),
                event.eventType(), PAYLOAD, DECIDED_AT)).thenReturn(eventWrite);
        when(pendingInsert.bind(PARTITION, EVENT_ID, event.aggregateType(), event.aggregateId(),
                event.eventType(), PAYLOAD, DECIDED_AT)).thenReturn(pendingWrite);
    }

    private static OutboxRepository.OutboxEvent event(String type) {
        return new OutboxRepository.OutboxEvent(PARTITION, EVENT_ID, "report", "report-1",
                type, PAYLOAD, DECIDED_AT, null, 0);
    }
}
