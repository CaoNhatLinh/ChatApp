package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ModerationReportLookupTest {
    @Test
    void identityReadReturnsAuthorityDecisionBeforeQueueProjectionMoves() {
        CqlSession session = mock(CqlSession.class);
        PreparedStatement authority = mock(PreparedStatement.class);
        PreparedStatement other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            return query.contains("decision_intents\n")
                    && query.contains("FROM reports_by_reporter WHERE reporter_id = ? AND created_at = ? AND report_id = ?")
                    ? authority : other;
        });
        var repository = new ModerationRepository(session);
        UUID reporter = UUID.randomUUID(), reportId = UUID.randomUUID(), createdAt = Uuids.timeBased();
        UUID assignedTo = UUID.randomUUID();
        Instant resolvedAt = Instant.parse("2026-11-03T08:00:00Z");
        BoundStatement bound = mock(BoundStatement.class);
        ResultSet result = mock(ResultSet.class);
        Row row = mock(Row.class);
        when(authority.bind(reporter, createdAt, reportId)).thenReturn(bound);
        when(bound.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).thenReturn(bound);
        when(session.execute(bound)).thenReturn(result);
        when(result.one()).thenReturn(row).thenReturn(null);
        when(row.getUuid("reporter_id")).thenReturn(reporter);
        when(row.getUuid("created_at")).thenReturn(createdAt);
        when(row.getUuid("report_id")).thenReturn(reportId);
        when(row.getString("report_status")).thenReturn("RESOLVED");
        when(row.getMap("decision_intents", String.class, String.class)).thenReturn(Map.of(
                "OPEN.nextStatus", "IN_REVIEW",
                "IN_REVIEW.nextStatus", "RESOLVED",
                "IN_REVIEW.assignedTo", assignedTo.toString(),
                "IN_REVIEW.resolvedAt", resolvedAt.toString(),
                "IN_REVIEW.resolutionCode", "REVIEWED"));

        var report = repository.findReportByIdentity(reporter, createdAt, reportId);
        assertThat(report.status()).isEqualTo("RESOLVED");
        assertThat(report.assignedTo()).isEqualTo(assignedTo);
        assertThat(report.resolvedAt()).isEqualTo(resolvedAt);
        assertThat(report.resolutionCode()).isEqualTo("REVIEWED");
        assertThat(repository.findReportByIdentity(reporter, createdAt, reportId)).isNull();
        verifyNoInteractions(other);
    }

    @Test
    void legacyDecisionWithNoIntentUsesOnlyMatchingReporterMetadata() {
        CqlSession session = mock(CqlSession.class);
        PreparedStatement authority = mock(PreparedStatement.class);
        PreparedStatement queue = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            return query.contains("SELECT * FROM reports_by_status_day") ? queue : authority;
        });
        var repository = new ModerationRepository(session);
        var createdAt = Uuids.startOf(Instant.parse("2026-11-03T00:30:00Z").toEpochMilli());
        var reportDay = LocalDate.ofInstant(Instant.ofEpochMilli(Uuids.unixTimestamp(createdAt)), ZoneOffset.UTC);
        UUID reporter = UUID.randomUUID(), reportId = UUID.randomUUID(), target = UUID.randomUUID();
        UUID assignee = UUID.randomUUID();
        Instant resolvedAt = Instant.parse("2026-11-03T08:00:00Z");
        BoundStatement authorityRead = mock(BoundStatement.class, RETURNS_SELF);
        BoundStatement queueRead = mock(BoundStatement.class, RETURNS_SELF);
        ResultSet authorityResult = mock(ResultSet.class);
        ResultSet queueResult = mock(ResultSet.class);
        Row authorityRow = mock(Row.class);
        Row queueRow = mock(Row.class);
        when(authority.bind(reporter, createdAt, reportId)).thenReturn(authorityRead);
        when(queue.bind("RESOLVED", reportDay, createdAt, reportId)).thenReturn(queueRead);
        when(session.execute(authorityRead)).thenReturn(authorityResult);
        when(session.execute(queueRead)).thenReturn(queueResult);
        when(authorityResult.one()).thenReturn(authorityRow);
        when(queueResult.one()).thenReturn(queueRow);
        when(authorityRow.getUuid("reporter_id")).thenReturn(reporter);
        when(authorityRow.getUuid("created_at")).thenReturn(createdAt);
        when(authorityRow.getUuid("report_id")).thenReturn(reportId);
        when(authorityRow.getString("report_status")).thenReturn("RESOLVED");
        when(authorityRow.getUuid("target_user_id")).thenReturn(target);
        when(authorityRow.getString("description")).thenReturn("canonical description");
        when(authorityRow.getMap("decision_intents", String.class, String.class)).thenReturn(null);
        when(queueRow.getUuid("reporter_id")).thenReturn(reporter, UUID.randomUUID());
        when(queueRow.getUuid("assigned_to")).thenReturn(assignee);
        when(queueRow.getInstant("resolved_at")).thenReturn(resolvedAt);
        when(queueRow.getString("resolution_code")).thenReturn("REVIEWED");
        when(queueRow.getUuid("target_user_id")).thenReturn(UUID.randomUUID());
        when(queueRow.getString("description")).thenReturn("stale projection description");

        var report = repository.findReportByIdentity(reporter, createdAt, reportId);
        assertThat(report).isEqualTo(new ModerationRepository.ReportRow(
                reportId, createdAt, reportDay, "RESOLVED", reporter, null, target, null, null, null,
                null, "canonical description", assignee, resolvedAt, "REVIEWED"));
        var mismatched = repository.findReportByIdentity(reporter, createdAt, reportId);
        assertThat(mismatched).isEqualTo(new ModerationRepository.ReportRow(
                reportId, createdAt, reportDay, "RESOLVED", reporter, null, target, null, null, null,
                null, "canonical description", null, null, null));
        var work = repository.reportWorkAuthority(ModerationRepository.reportWorkKey(mismatched));
        assertThat(work.report()).isEqualTo(mismatched);
        assertThat(work.intent()).isEmpty();
        verify(authorityRead, times(3)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(queueRead, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }

    @Test
    void memberHistoryUsesQuorumAndBoundsTheReporterPartitionRead() {
        CqlSession session = mock(CqlSession.class);
        PreparedStatement list = mock(PreparedStatement.class);
        PreparedStatement other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(invocation ->
                ((String) invocation.getArgument(0)).contains("WHERE reporter_id = ? LIMIT ?") ? list : other);
        var repository = new ModerationRepository(session);
        UUID reporter = UUID.randomUUID();
        BoundStatement read = mock(BoundStatement.class, RETURNS_SELF);
        ResultSet result = mock(ResultSet.class);
        when(list.bind(reporter, 100)).thenReturn(read);
        when(session.execute(read)).thenReturn(result);
        when(result.all()).thenReturn(List.of());

        assertThat(repository.listReportsByReporter(reporter, 500)).isEmpty();
        verify(read).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verifyNoInteractions(other);
    }

    @Test
    void pointReadBindsFullKeyAndNeverReadsTheBoundedQueue() {
        CqlSession session = mock(CqlSession.class);
        PreparedStatement pointRead = mock(PreparedStatement.class);
        PreparedStatement other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            return query.contains("FROM reports_by_status_day")
                    && query.contains("WHERE report_status = ? AND report_day = ? AND created_at = ? AND report_id = ?")
                    && !query.contains("LIMIT") ? pointRead : other;
        });
        var repository = new ModerationRepository(session);
        var day = LocalDate.of(2026, 10, 23);
        UUID createdAt = Uuids.timeBased(), reportId = UUID.randomUUID();
        BoundStatement bound = mock(BoundStatement.class, RETURNS_SELF);
        ResultSet result = mock(ResultSet.class);
        Row row = mock(Row.class);
        when(pointRead.bind("OPEN", day, createdAt, reportId)).thenReturn(bound);
        when(session.execute(bound)).thenReturn(result);
        when(result.one()).thenReturn(row).thenReturn(null);
        when(row.getUuid("report_id")).thenReturn(reportId);
        when(row.getUuid("created_at")).thenReturn(createdAt);
        when(row.getLocalDate("report_day")).thenReturn(day);
        when(row.getString("report_status")).thenReturn("OPEN");

        var report = repository.findReport("OPEN", day, createdAt, reportId);
        assertThat(report.reportId()).isEqualTo(reportId);
        assertThat(report.createdAtKey()).isEqualTo(createdAt);
        assertThat(repository.findReport("OPEN", day, createdAt, reportId)).isNull();
        verifyNoInteractions(other);
        verify(bound, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(result, times(2)).one();
        verifyNoMoreInteractions(result);
    }
}
