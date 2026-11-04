package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CassandraCallHistoryRepositoryTest {
    final CqlSession session = mock(CqlSession.class);
    final Map<String, PreparedStatement> queries = new LinkedHashMap<>();
    final Map<String, BoundStatement> statements = new LinkedHashMap<>();
    final ResultSet result = mock(ResultSet.class);
    final Instant now = Instant.parse("2026-10-22T23:59:59.999Z");
    final CallState call = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), Uuids.startOf(now.toEpochMilli()),
            UUID.randomUUID(), UUID.randomUUID(), CallState.Type.VOICE, now, UUID.randomUUID());
    final CassandraCallHistoryRepository history;
    CassandraCallHistoryRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String cql = invocation.getArgument(0);
            var query = mock(PreparedStatement.class); var statement = mock(BoundStatement.class, RETURNS_SELF);
            when(query.bind(any(Object[].class))).thenReturn(statement);
            queries.put(cql, query); statements.put(cql, statement); return query;
        });
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        when(result.iterator()).thenAnswer(ignored -> List.<Row>of().iterator());
        history = new CassandraCallHistoryRepository(session);
    }
    String query(String part) { return queries.keySet().stream().filter(sql -> sql.contains(part)).findFirst().orElseThrow(); }
    @Test void registrationWritesRoomAndBothActorsWithOriginalUtcMonthAndOrder() {
        history.register(call);
        String room = query("INSERT INTO calls_by_conversation"), own = query("INSERT INTO calls_by_user");
        verify(queries.get(room)).bind(call.conversationId(), "2026-10", call.startedOrder(), call.callId());
        verify(queries.get(own)).bind(call.callerId(), "2026-10", call.startedOrder(), call.conversationId(), call.callId());
        verify(queries.get(own)).bind(call.calleeId(), "2026-10", call.startedOrder(), call.conversationId(), call.callId());
        verify(session, times(3)).execute(any(BoundStatement.class));
        for (var statement : List.of(statements.get(room), statements.get(own))) {
            verify(statement, atLeastOnce()).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
            verify(statement, atLeastOnce()).setIdempotent(true);
        }
        assertThat(room + own).doesNotContain("status", "provider", "TTL", "joined", "UPDATE");
    }
    @Test void partialWriteFailureIsNotSwallowed() {
        when(session.execute(statements.get(query("INSERT INTO calls_by_user")))).thenThrow(new IllegalStateException());
        assertThatThrownBy(() -> history.register(call)).isInstanceOf(IllegalStateException.class);
        verify(session).execute(statements.get(query("INSERT INTO calls_by_conversation")));
    }
    @Test void bothContinuationQueriesUseAllDescendingTieKeysAndBoundedLimit() {
        var key = new CallHistoryRepository.Key(call.startedOrder(), call.conversationId(), call.callId());
        var month = YearMonth.of(2026, 10);
        history.own(call.callerId(), month, key, 50); history.conversation(call.conversationId(), month, key, 50);
        String own = query("(started_at,conversation_id,call_id)<"), room = query("(started_at,call_id)<");
        verify(queries.get(own)).bind(call.callerId(), "2026-10", key.startedOrder(), key.conversationId(), key.callId(), 50);
        verify(queries.get(room)).bind(call.conversationId(), "2026-10", key.startedOrder(), key.callId(), 50);
        assertThat(own + room).contains("LIMIT ?").doesNotContain("ALLOW FILTERING", "OFFSET");
    }
    @Test void headQueriesStayInsideOneMonthPartitionAndInvalidLimitsNeverExecute() {
        history.own(call.callerId(), YearMonth.of(2026, 10), null, 1);
        history.conversation(call.conversationId(), YearMonth.of(2026, 10), null, 1);
        verify(queries.get(query("WHERE user_id=? AND call_month=? LIMIT"))).bind(call.callerId(), "2026-10", 1);
        verify(queries.get(query("WHERE conversation_id=? AND call_month=? LIMIT"))).bind(call.conversationId(), "2026-10", 1);
        clearInvocations(session);
        for (int limit : new int[]{0, -1, 51}) assertThatThrownBy(() -> history.own(call.callerId(), YearMonth.of(2026, 10), null, limit)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(session);
    }
    @Test void returnedKeysPreserveRowOrderRoomScopeAndNeverConsumeBeyondLimit() {
        var first = mock(Row.class); var second = mock(Row.class);
        when(first.getUuid("started_at")).thenReturn(call.startedOrder());
        when(first.getUuid("call_id")).thenReturn(call.callId());
        when(first.getUuid("conversation_id")).thenReturn(call.conversationId());
        when(result.iterator()).thenAnswer(ignored -> List.of(first, second).iterator());
        var expected = new CallHistoryRepository.Key(call.startedOrder(), call.conversationId(), call.callId());
        assertThat(history.own(call.callerId(), YearMonth.of(2026, 10), null, 1)).containsExactly(expected);
        assertThat(history.conversation(call.conversationId(), YearMonth.of(2026, 10), null, 1)).containsExactly(expected);
        verifyNoInteractions(second);
        verify(result, never()).all();
    }
    @Test void terminalAndNoncanonicalCreationCannotWriteHistoryHints() {
        var ended = call.apply(call.callerId(), CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        assertThatThrownBy(() -> history.register(ended)).isInstanceOf(IllegalArgumentException.class);
        var invalid = CallState.ringing(call.conversationId(), call.callId(), UUID.randomUUID(), call.callerId(),
                call.calleeId(), call.callType(), now, UUID.randomUUID());
        assertThatThrownBy(() -> history.register(invalid)).isInstanceOf(IllegalArgumentException.class);
        verify(session, never()).execute(any(BoundStatement.class));
    }
    @Test void continuationCannotCrossMonthOrRoomBeforeExecuting() {
        var key = new CallHistoryRepository.Key(call.startedOrder(), call.conversationId(), call.callId());
        assertThatThrownBy(() -> history.own(call.callerId(), YearMonth.of(2026, 9), key, 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> history.conversation(UUID.randomUUID(), YearMonth.of(2026, 10), key, 1)).isInstanceOf(IllegalArgumentException.class);
        verify(session, never()).execute(any(BoundStatement.class));
    }
    @Test void uncertainRegistrationRetryUsesTheSameThreeImmutableKeys() {
        var own = statements.get(query("INSERT INTO calls_by_user"));
        when(session.execute(own)).thenReturn(result).thenThrow(new IllegalStateException("callee write uncertain")).thenReturn(result);
        assertThatThrownBy(() -> history.register(call)).isInstanceOf(IllegalStateException.class);
        history.register(call);
        verify(queries.get(query("INSERT INTO calls_by_conversation")), times(2)).bind(call.conversationId(), "2026-10", call.startedOrder(), call.callId());
        verify(queries.get(query("INSERT INTO calls_by_user")), times(2)).bind(call.callerId(), "2026-10", call.startedOrder(), call.conversationId(), call.callId());
        verify(queries.get(query("INSERT INTO calls_by_user")), times(2)).bind(call.calleeId(), "2026-10", call.startedOrder(), call.conversationId(), call.callId());
    }
}
