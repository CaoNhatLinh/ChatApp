package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.AsyncResultSet;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ModerationReportQueueVisibilityTest {
    private final CqlSession session = mock(CqlSession.class);
    private final PreparedStatement queueRead = mock(PreparedStatement.class);
    private final PreparedStatement authorityRead = mock(PreparedStatement.class);
    private final LocalDate day = LocalDate.of(2026, 11, 3);
    private final ModerationRepository repository;

    ModerationReportQueueVisibilityTest() {
        var other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            if (query.contains("FROM reports_by_status_day")
                    && query.contains("WHERE report_status = ? AND report_day = ? LIMIT ?")) return queueRead;
            if (query.contains("SELECT report_status FROM reports_by_reporter")
                    && query.contains("WHERE reporter_id = ? AND created_at = ? AND report_id = ?")) return authorityRead;
            return other;
        });
        repository = new ModerationRepository(session);
    }

    @Test
    void hidesStaleAndMissingAuthorityRowsWithoutDisturbingVisibleQueueOrder() {
        var first = candidate();
        var stale = candidate();
        var missing = candidate();
        var last = candidate();
        var queue = stubQueue(first, stale, missing, last);
        stubStatus(first, "OPEN");
        stubStatus(stale, "RESOLVED");
        stubStatus(missing, null);
        stubStatus(last, "OPEN");

        assertThat(repository.listReports("OPEN", day, 50))
                .extracting(ModerationRepository.ReportRow::reportId)
                .containsExactly(first.id(), last.id());
        verify(queueRead).bind("OPEN", day, 50);
        verify(queue).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        for (var candidate : List.of(first, stale, missing, last)) {
            verify(authorityRead).bind(candidate.reporter(), candidate.createdAt(), candidate.id());
        }
    }

    @Test
    void authorityReadFailureFailsRequestInsteadOfReturningAnApparentlyEmptyQueue() {
        var candidate = candidate();
        stubQueue(candidate);
        var bound = bindAuthority(candidate);
        when(session.executeAsync(bound))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("authority unavailable")));

        assertThatThrownBy(() -> repository.listReports("OPEN", day, 50))
                .hasStackTraceContaining("authority unavailable");
        verify(bound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }

    private Candidate candidate() {
        return new Candidate(UUID.randomUUID(), UUID.randomUUID(), Uuids.timeBased());
    }

    private BoundStatement stubQueue(Candidate... candidates) {
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(queueRead.bind("OPEN", day, 50)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        List<Row> rows = Arrays.stream(candidates).map(candidate -> {
            var row = mock(Row.class);
            when(row.getUuid("report_id")).thenReturn(candidate.id());
            when(row.getUuid("reporter_id")).thenReturn(candidate.reporter());
            when(row.getUuid("created_at")).thenReturn(candidate.createdAt());
            when(row.getLocalDate("report_day")).thenReturn(day);
            when(row.getString("report_status")).thenReturn("OPEN");
            return row;
        }).toList();
        when(result.all()).thenReturn(rows);
        return query;
    }

    private BoundStatement bindAuthority(Candidate candidate) {
        var query = mock(BoundStatement.class, RETURNS_SELF);
        when(authorityRead.bind(candidate.reporter(), candidate.createdAt(), candidate.id())).thenReturn(query);
        return query;
    }

    private void stubStatus(Candidate candidate, String status) {
        var query = bindAuthority(candidate);
        var result = mock(AsyncResultSet.class);
        if (status != null) {
            var row = mock(Row.class);
            when(row.getString("report_status")).thenReturn(status);
            when(result.one()).thenReturn(row);
        }
        when(session.executeAsync(query)).thenReturn(CompletableFuture.completedFuture(result));
    }

    private record Candidate(UUID id, UUID reporter, UUID createdAt) {}
}
