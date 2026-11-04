package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ReportWorkDiscoveryTest {
    @Test
    void advancesPastExactClusteringTupleAndLoadsOnlyItsIntentFromAuthority() {
        var session = mock(CqlSession.class);
        var other = mock(PreparedStatement.class);
        var page = mock(PreparedStatement.class);
        var authority = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            if (query.contains("FROM report_decision_work_by_shard")
                    && query.contains("WHERE work_shard = ? AND (report_id, previous_status) > (?, ?) LIMIT ?")) return page;
            if (query.contains("description, decision_intents")
                    && query.contains("WHERE reporter_id = ? AND created_at = ? AND report_id = ?")) return authority;
            return other;
        });
        var repository = new ModerationRepository(session);
        byte shard = 3;
        var id = UUID.randomUUID();
        var reporter = UUID.randomUUID();
        var created = Uuids.timeBased();
        var after = new ModerationRepository.ReportWorkKey(shard, id, "IN_REVIEW", reporter, created);
        var next = new ModerationRepository.ReportWorkKey(shard, id, "OPEN", reporter, created);
        var pageBound = mock(BoundStatement.class, RETURNS_SELF);
        var authorityBound = mock(BoundStatement.class, RETURNS_SELF);
        var pageResult = mock(ResultSet.class);
        var authorityResult = mock(ResultSet.class);
        var row = mock(Row.class);
        when(page.bind(shard, id, "IN_REVIEW", 50)).thenReturn(pageBound);
        when(session.execute(pageBound)).thenReturn(pageResult);
        when(pageResult.all()).thenReturn(List.of(row));
        when(row.getUuid("report_id")).thenReturn(id);
        when(row.getUuid("reporter_id")).thenReturn(reporter);
        when(row.getUuid("created_at")).thenReturn(created);
        when(row.getString("previous_status")).thenReturn("OPEN");
        when(authority.bind(reporter, created, id)).thenReturn(authorityBound);
        when(session.execute(authorityBound)).thenReturn(authorityResult);
        when(authorityResult.one()).thenReturn(row);
        when(row.getMap("decision_intents", String.class, String.class))
                .thenReturn(Map.of("OPEN.id", "review", "IN_REVIEW.id", "finish"));

        assertThat(repository.reportWorkPage(shard, after, 500)).containsExactly(next);
        assertThat(repository.reportWorkAuthority(next).intent()).isEqualTo(Map.of("id", "review"));
        assertThatThrownBy(() -> repository.reportWorkPage((byte) 4, after, 10))
                .isInstanceOf(IllegalArgumentException.class);
        verify(pageBound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(authorityBound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verifyNoInteractions(other);
    }
}
