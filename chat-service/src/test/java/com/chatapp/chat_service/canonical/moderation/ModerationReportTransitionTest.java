package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Statement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ModerationReportTransitionTest {
    private static final String SOURCE_STAMP_QUERY = "SELECT writetime(reporter_id) AS projection_stamp";
    private final CqlSession session = mock(CqlSession.class);
    private final Map<BoundStatement, List<Object>> bindings = new IdentityHashMap<>();
    private final ModerationRepository repository;
    private final UUID reportId = UUID.randomUUID();
    private final UUID reporter = UUID.randomUUID();
    private final UUID target = UUID.randomUUID();
    private final UUID createdAt = Uuids.startOf(Instant.parse("2026-11-03T00:30:00Z").toEpochMilli());
    private final LocalDate day = LocalDate.of(2026, 11, 3);
    private final UUID actor = UUID.randomUUID();
    private final UUID decisionId = Uuids.timeBased();
    private final long sourceStamp = Uuids.unixTimestamp(decisionId) * 1_000L + 10;
    private final Instant resolvedAt = Instant.parse("2026-11-03T01:00:00Z");
    private final ModerationRepository.ReportRow open = new ModerationRepository.ReportRow(
            reportId, createdAt, day, "OPEN", reporter, "USER", target, null, null, null,
            "SPAM", "Repeated spam", null, null, null);

    ModerationReportTransitionTest() {
        when(session.prepare(anyString())).thenAnswer(call -> {
            var prepared = mock(PreparedStatement.class);
            when(prepared.getQuery()).thenReturn(call.getArgument(0));
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                var bound = mock(BoundStatement.class, RETURNS_SELF);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                bindings.put(bound, Arrays.asList(binding.getArguments()));
                return bound;
            });
            return prepared;
        });
        repository = new ModerationRepository(session);
    }

    @Test
    void creationSubmitsAuthorityAndOpenQueueWithTheSameIdentityInOneLoggedBatch() {
        var report = repository.createReport(reporter, "USER", target, null, null, null, "SPAM", "Repeated spam");

        assertThat(report.createdAtKey().version()).isEqualTo(1);
        assertThat(report.reportDay()).isEqualTo(LocalDate.ofInstant(
                Instant.ofEpochMilli(Uuids.unixTimestamp(report.createdAtKey())), java.time.ZoneOffset.UTC));
        var captor = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(captor.capture());
        verify(session, never()).execute(any(BoundStatement.class));
        var batch = captor.getValue();
        assertThat(batch.getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(batch.getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        assertThat(batch.size()).isEqualTo(2);
        var statements = batch.iterator();
        var authority = (BoundStatement) statements.next();
        var queue = (BoundStatement) statements.next();
        assertThat(authority.getPreparedStatement().getQuery()).contains("INSERT INTO reports_by_reporter");
        assertThat(bindings.get(authority)).containsExactly(reporter, report.createdAtKey(), report.reportId(), "OPEN",
                "USER", target, null, null, null, "SPAM", "Repeated spam");
        assertThat(queue.getPreparedStatement().getQuery()).contains("INSERT INTO reports_by_status_day");
        assertThat(bindings.get(queue)).containsExactly("OPEN", report.reportDay(), report.createdAtKey(), report.reportId(),
                reporter, "USER", target, null, null, null, "SPAM", "Repeated spam", null, null, null);
    }

    @Test
    void keyedCreationUsesStableSeedAndIncludesItsAuditWorkInTheBatch() {
        var command = new ModerationRepository.CreateCommand("fingerprint", createdAt, reportId, target);
        var authority = mock(ResultSet.class);
        var row = mock(Row.class);
        when(row.getString("report_status")).thenReturn("OPEN");
        when(row.getUuid("created_at")).thenReturn(createdAt);
        when(row.getUuid("report_id")).thenReturn(reportId);
        when(authority.one()).thenReturn(null, row);
        when(session.execute(any(BoundStatement.class))).thenReturn(authority);

        var report = repository.completeCreateCommand(reporter, command, "USER", null, null, null, "SPAM", "details");

        assertThat(report.reportId()).isEqualTo(reportId);
        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(batch.capture());
        assertThat(batch.getValue().getQueryTimestamp()).isEqualTo(1L);
        assertThat(batch.getValue().getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(batch.getValue().getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        var statements = batch.getValue().iterator();
        assertThat(bindings.get((BoundStatement) statements.next())).startsWith(reporter, createdAt, reportId, "OPEN");
        assertThat(bindings.get((BoundStatement) statements.next())).startsWith("OPEN", day, createdAt, reportId);
        assertThat(bindings.get((BoundStatement) statements.next())).containsExactly(
                ModerationRepository.reportWorkKey(open).shard(), reportId, "CREATE", reporter, createdAt);
        assertThat(statements.hasNext()).isFalse();

        assertThat(repository.completeCreateCommand(reporter, command, "USER", null, null, null, "SPAM", "details").reportId())
                .isEqualTo(reportId);
        verify(session).execute(any(BatchStatement.class));
    }

    @Test
    void losingPreparationDeletesOnlyItsOwnGenerationAndNeverSeedsTheReport() {
        UUID clientId = UUID.randomUUID();
        var candidate = new ModerationRepository.CreateCommand("losing", createdAt, reportId, target);
        var preparation = new ModerationRepository.CreatePreparation((byte) 0, reporter, clientId, candidate,
                "USER", null, null, null, "SPAM", "details");
        var authority = mock(ResultSet.class);
        var row = mock(Row.class);
        when(row.getString("fingerprint")).thenReturn("winning");
        when(authority.one()).thenReturn(row);
        when(session.execute(any(BoundStatement.class))).thenReturn(authority);

        assertThat(repository.resumePreparedCreate(preparation)).isNull();

        var query = ArgumentCaptor.forClass(BoundStatement.class);
        verify(session, times(2)).execute(query.capture());
        verify(session, never()).execute(any(BatchStatement.class));
        var deletion = query.getAllValues().get(1);
        assertThat(deletion.getPreparedStatement().getQuery()).contains("DELETE FROM report_create_preparation_by_shard", "IF report_id = ?");
        assertThat(bindings.get(deletion)).containsExactly((byte) 0, reporter, clientId, reportId);
        verify(deletion).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(deletion).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }

    @Test
    void winningDecisionMovesQueueEntryOnlyAfterConditionalReporterWrite() {
        stubCasResult(true);

        var updated = repository.transitionReport(open, "RESOLVED", actor, resolvedAt, "REVIEWED", actor, "Evidence checked", decisionId);

        assertThat(updated).isEqualTo(new ModerationRepository.ReportRow(
                reportId, createdAt, day, "RESOLVED", reporter, "USER", target, null, null, null,
                "SPAM", "Repeated spam", actor, resolvedAt, "REVIEWED"));
        var commandCaptor = ArgumentCaptor.forClass(BoundStatement.class);
        var batchCaptor = ArgumentCaptor.forClass(BatchStatement.class);
        var order = inOrder(session);
        order.verify(session, times(3)).execute(commandCaptor.capture());
        order.verify(session).execute(batchCaptor.capture());
        verify(session, times(3)).execute(any(BoundStatement.class));
        assertSourceStampRead(commandCaptor.getAllValues().get(0));
        assertWorkPointer(commandCaptor.getAllValues().get(1));
        assertConditionalReporterWrite(commandCaptor.getAllValues().get(2), "RESOLVED");

        var batch = batchCaptor.getValue();
        assertThat(batch.getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(batch.getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        assertThat(batch.getQueryTimestamp()).isEqualTo(sourceStamp + 1);
        assertThat(batch.size()).isEqualTo(2);
        var statements = batch.iterator();
        var insert = (BoundStatement) statements.next();
        assertThat(insert.getPreparedStatement().getQuery()).contains("INSERT INTO reports_by_status_day");
        assertThat(bindings.get(insert)).containsExactly("RESOLVED", day, createdAt, reportId, reporter,
                "USER", target, null, null, null, "SPAM", "Repeated spam", actor, resolvedAt, "REVIEWED");
        var delete = (BoundStatement) statements.next();
        assertThat(delete.getPreparedStatement().getQuery()).contains("DELETE FROM reports_by_status_day");
        assertThat(bindings.get(delete)).containsExactly("OPEN", day, createdAt, reportId);
    }

    @Test
    void staleDecisionDoesNotPublishOrDeleteAnyQueueEntry() {
        stubCasResult(false);

        assertThat(repository.transitionReport(open, "DISMISSED", actor, resolvedAt, "DISMISSED", actor, "Evidence checked", decisionId)).isNull();

        var commandCaptor = ArgumentCaptor.forClass(BoundStatement.class);
        verify(session, times(3)).execute(commandCaptor.capture());
        assertSourceStampRead(commandCaptor.getAllValues().get(0));
        assertWorkPointer(commandCaptor.getAllValues().get(1));
        assertConditionalReporterWrite(commandCaptor.getAllValues().get(2), "DISMISSED");
        verify(session, never()).execute(any(BatchStatement.class));
        assertThat(bindings).hasSize(3);
    }

    @Test
    void queueFailureOccursAfterTheCompleteDecisionWasSubmittedWithTheStatusClaim() {
        stubCasResult(true);
        when(session.execute(any(BatchStatement.class))).thenThrow(new IllegalStateException("queue unavailable"));
        assertThatThrownBy(() -> repository.transitionReport(open, "RESOLVED", target, resolvedAt,
                "REVIEWED", actor, "Evidence checked", decisionId)).hasMessage("queue unavailable");
        var claim = ArgumentCaptor.forClass(BoundStatement.class);
        var order = inOrder(session);
        order.verify(session, times(3)).execute(claim.capture());
        order.verify(session).execute(any(BatchStatement.class));
        assertSourceStampRead(claim.getAllValues().get(0));
        assertWorkPointer(claim.getAllValues().get(1));
        assertConditionalReporterWrite(claim.getAllValues().get(2), "RESOLVED", target);
    }

    @Test
    void undiscoverableDecisionIsNotAttemptedWhenPointerWriteFails() {
        stubSourceStamp(sourceStamp);
        doThrow(new IllegalStateException("pointer unavailable")).when(session).execute(
                argThat((Statement<?> statement) -> statement instanceof BoundStatement bound
                        && bound.getPreparedStatement().getQuery().contains("INSERT INTO report_decision_work_by_shard")));
        assertThatThrownBy(() -> repository.transitionReport(open, "RESOLVED", actor, resolvedAt,
                "REVIEWED", actor, "Evidence checked", decisionId)).hasMessage("pointer unavailable");
        var pointer = ArgumentCaptor.forClass(BoundStatement.class);
        verify(session, times(2)).execute(pointer.capture());
        assertSourceStampRead(pointer.getAllValues().get(0));
        assertWorkPointer(pointer.getAllValues().get(1));
        verify(session, never()).execute(any(BatchStatement.class));
    }

    @Test
    void missingSourceProjectionDoesNotRegisterWorkOrAttemptCas() {
        stubSourceStamp(null);

        assertThat(repository.transitionReport(open, "RESOLVED", actor, resolvedAt,
                "REVIEWED", actor, "Evidence checked", decisionId)).isNull();

        var query = ArgumentCaptor.forClass(BoundStatement.class);
        verify(session).execute(query.capture());
        assertSourceStampRead(query.getValue());
        verify(session, never()).execute(any(BatchStatement.class));
        assertThat(bindings).hasSize(1);
    }

    @Test
    void replayUsesThePersistedStampAndDoesNotReinsertAnObsoleteDestination() {
        var key = new ModerationRepository.ReportWorkKey((byte) Math.floorMod(reportId.hashCode(), 16),
                reportId, "OPEN", reporter, createdAt);
        var intent = Map.of("nextStatus", "IN_REVIEW", "assignedTo", actor.toString(),
                "projectionStamp", Long.toString(sourceStamp));

        repository.replayReportProjection(key, new ModerationRepository.ReportWorkAuthority(
                authorityAt("IN_REVIEW"), intent));
        repository.replayReportProjection(key, new ModerationRepository.ReportWorkAuthority(
                authorityAt("RESOLVED"), intent));

        var batches = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session, times(2)).execute(batches.capture());
        verify(session, never()).execute(any(BoundStatement.class));
        var active = batches.getAllValues().get(0);
        assertThat(active.getQueryTimestamp()).isEqualTo(sourceStamp);
        assertThat(active.size()).isEqualTo(2);
        var statements = active.iterator();
        var destination = (BoundStatement) statements.next();
        assertThat(destination.getPreparedStatement().getQuery()).contains("INSERT INTO reports_by_status_day");
        assertThat(bindings.get(destination)).containsExactly("IN_REVIEW", day, createdAt, reportId, reporter,
                "USER", target, null, null, null, "SPAM", "Repeated spam", actor, null, null);
        var sourceDelete = (BoundStatement) statements.next();
        var obsolete = batches.getAllValues().get(1);
        assertThat(obsolete.getQueryTimestamp()).isEqualTo(sourceStamp);
        assertThat(obsolete.size()).isEqualTo(1);
        var obsoleteSourceDelete = (BoundStatement) obsolete.iterator().next();
        assertThat(sourceDelete.getPreparedStatement().getQuery()).contains("DELETE FROM reports_by_status_day");
        assertThat(obsoleteSourceDelete.getPreparedStatement().getQuery()).contains("DELETE FROM reports_by_status_day");
        assertThat(bindings.get(sourceDelete)).containsExactly("OPEN", day, createdAt, reportId);
        assertThat(bindings.get(obsoleteSourceDelete)).containsExactly("OPEN", day, createdAt, reportId);
    }

    private ModerationRepository.ReportRow authorityAt(String status) {
        return new ModerationRepository.ReportRow(reportId, createdAt, day, status, reporter,
                "USER", target, null, null, null, "SPAM", "Repeated spam", null, null, null);
    }

    private void assertSourceStampRead(BoundStatement statement) {
        assertThat(statement.getPreparedStatement().getQuery()).contains(SOURCE_STAMP_QUERY)
                .contains("FROM reports_by_status_day")
                .contains("WHERE report_status = ? AND report_day = ? AND created_at = ? AND report_id = ?");
        assertThat(bindings.get(statement)).containsExactly("OPEN", day, createdAt, reportId);
        verify(statement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }

    private void assertWorkPointer(BoundStatement statement) {
        assertThat(statement.getPreparedStatement().getQuery()).contains("INSERT INTO report_decision_work_by_shard");
        assertThat(bindings.get(statement)).containsExactly((byte) Math.floorMod(reportId.hashCode(), 16),
                reportId, "OPEN", reporter, createdAt);
        verify(statement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }

    private void stubCasResult(boolean applied) {
        var result = mock(ResultSet.class);
        when(result.wasApplied()).thenReturn(applied);
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        stubSourceStamp(sourceStamp);
    }

    private void stubSourceStamp(Long stamp) {
        var result = mock(ResultSet.class);
        if (stamp != null) {
            var row = mock(Row.class);
            when(row.getLong("projection_stamp")).thenReturn(stamp);
            when(result.one()).thenReturn(row);
        }
        when(session.execute(argThat((Statement<?> statement) ->
                statement instanceof BoundStatement bound
                        && bound.getPreparedStatement().getQuery().contains(SOURCE_STAMP_QUERY))))
                .thenReturn(result);
    }

    private void assertConditionalReporterWrite(BoundStatement statement, String nextStatus) {
        assertConditionalReporterWrite(statement, nextStatus, actor);
    }

    private void assertConditionalReporterWrite(BoundStatement statement, String nextStatus, UUID assignee) {
        assertThat(statement.getPreparedStatement().getQuery()).contains("UPDATE reports_by_reporter",
                "decision_intents = decision_intents + ?",
                "WHERE reporter_id = ? AND created_at = ? AND report_id = ?", "IF report_status = ?");
        var values = bindings.get(statement);
        assertThat(values).hasSize(6);
        assertThat(values.get(0)).isEqualTo(nextStatus);
        assertThat(values.subList(2, 6)).containsExactly(reporter, createdAt, reportId, "OPEN");
        var intent = (Map<?, ?>) values.get(1);
        assertThat(intent).hasSize(9);
        assertThat(intent.get("OPEN.outboxRoute")).isEqualTo("sharded-v1");
        assertThat(intent.get("OPEN.projectionStamp")).isEqualTo(Long.toString(sourceStamp + 1));
        assertThat(intent.get("OPEN.nextStatus")).isEqualTo(nextStatus);
        assertThat(intent.get("OPEN.actorId")).isEqualTo(actor.toString());
        assertThat(intent.get("OPEN.assignedTo")).isEqualTo(assignee.toString());
        assertThat(intent.get("OPEN.reason")).isEqualTo("Evidence checked");
        assertThat(intent.get("OPEN.resolvedAt")).isEqualTo(resolvedAt.toString());
        assertThat(intent.get("OPEN.resolutionCode")).isEqualTo("RESOLVED".equals(nextStatus) ? "REVIEWED" : "DISMISSED");
        assertThat(intent.get("OPEN.id")).isEqualTo(decisionId.toString());
        verify(statement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(statement).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }
}
