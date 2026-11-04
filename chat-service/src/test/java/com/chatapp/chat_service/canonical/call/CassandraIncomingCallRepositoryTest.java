package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CassandraIncomingCallRepositoryTest {
    final CqlSession session = mock(CqlSession.class);
    final Map<String, PreparedStatement> prepared = new LinkedHashMap<>();
    final Map<String, BoundStatement> bound = new LinkedHashMap<>();
    final ResultSet result = mock(ResultSet.class);
    final Instant now = Instant.parse("2026-10-22T09:00:00Z");
    final CallState call = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
            UUID.randomUUID(), UUID.randomUUID(), CallState.Type.VOICE, now, UUID.randomUUID());
    final CassandraIncomingCallRepository incoming;

    CassandraIncomingCallRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String cql = invocation.getArgument(0);
            var query = mock(PreparedStatement.class);
            var statement = mock(BoundStatement.class, RETURNS_SELF);
            when(query.bind(any(Object[].class))).thenReturn(statement);
            prepared.put(cql, query); bound.put(cql, statement); return query;
        });
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        when(result.iterator()).thenAnswer(invocation -> Collections.<Row>emptyIterator());
        incoming = new CassandraIncomingCallRepository(session);
    }

    String query(String prefix) {
        return prepared.keySet().stream().filter(sql -> sql.startsWith(prefix)).findFirst().orElseThrow();
    }

    @Test void registrationWritesOnlyTheImmutableKeyAtLocalQuorum() {
        incoming.register(call);
        String insert = query("INSERT");
        assertThat(insert).isEqualTo("INSERT INTO incoming_calls_by_user (callee_id,ring_deadline,conversation_id,call_id) VALUES (?,?,?,?)");
        verify(prepared.get(insert)).bind(call.calleeId(), call.deadline(), call.conversationId(), call.callId());
        verify(bound.get(insert)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(bound.get(insert)).setIdempotent(true);
        verify(bound.get(insert), never()).setSerialConsistencyLevel(any());
        assertThat(prepared).hasSize(3);
        assertThat(prepared.keySet()).noneMatch(sql -> sql.contains("DELETE") || sql.contains("revision") || sql.contains("ALLOW FILTERING"));
    }

    @Test void onlyNewRingingCallsCanRegister() {
        var accepted = call.apply(call.calleeId(), CallState.Action.ACCEPT, now.plusSeconds(1), UUID.randomUUID());
        var heartbeat = call.apply(call.callerId(), CallState.Action.HEARTBEAT, now.plusSeconds(1), UUID.randomUUID());
        var ended = call.apply(call.callerId(), CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        for (CallState invalid : List.of(accepted, heartbeat, ended)) {
            assertThatThrownBy(() -> incoming.register(invalid)).isInstanceOf(IllegalArgumentException.class);
        }
        verify(session, never()).execute(any(BoundStatement.class));
    }

    @Test void firstPageBindsOneCalleeAndDeadlineWithAServerLimit() {
        assertThat(incoming.page(call.calleeId(), now, null, 25)).isEmpty();
        String first = query("SELECT ring_deadline,conversation_id,call_id FROM incoming_calls_by_user WHERE callee_id=? AND ring_deadline");
        assertThat(first).endsWith("ring_deadline>? LIMIT ?").doesNotContain("ALLOW FILTERING", "ORDER BY");
        verify(prepared.get(first)).bind(call.calleeId(), now, 25);
        verify(bound.get(first)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(bound.get(first)).setIdempotent(true);
    }

    @Test void continuationUsesOnlyTheCompleteTupleSoDeadlineTiesCannotBeSkipped() {
        var after = new IncomingCallRepository.Key(call.deadline(), call.conversationId(), call.callId());
        incoming.page(call.calleeId(), now, after, 1);
        String next = prepared.keySet().stream().filter(sql -> sql.contains("AND (ring_deadline,")).findFirst().orElseThrow();
        assertThat(next).isEqualTo("SELECT ring_deadline,conversation_id,call_id FROM incoming_calls_by_user WHERE callee_id=? AND (ring_deadline,conversation_id,call_id) > (?,?,?) LIMIT ?");
        verify(prepared.get(next)).bind(call.calleeId(), after.deadline(), after.conversationId(), after.callId(), 1);
        verify(bound.get(next)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(bound.get(next)).setIdempotent(true);
    }

    @Test void rowsMapToCompleteDiscoveryKeysInDriverOrder() {
        UUID otherRoom = UUID.randomUUID(), otherCall = UUID.randomUUID();
        Row first = row(call.deadline(), call.conversationId(), call.callId());
        Row tied = row(call.deadline(), otherRoom, otherCall);
        when(result.iterator()).thenAnswer(invocation -> List.of(first, tied).iterator());
        var keys = incoming.page(call.calleeId(), now, null, 2);
        assertThat(keys).containsExactly(
                new IncomingCallRepository.Key(call.deadline(), call.conversationId(), call.callId()),
                new IncomingCallRepository.Key(call.deadline(), otherRoom, otherCall));
        assertThatThrownBy(() -> keys.add(keys.get(0))).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test void pageLimitIsAlwaysBetweenOneAndFifty() {
        for (int invalid : new int[] {Integer.MIN_VALUE, 0, 51, Integer.MAX_VALUE}) {
            assertThatThrownBy(() -> incoming.page(call.calleeId(), now, null, invalid))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        verify(session, never()).execute(any(BoundStatement.class));
        incoming.page(call.calleeId(), now, null, 1);
        incoming.page(call.calleeId(), now, null, 50);
        String first = query("SELECT ring_deadline,conversation_id,call_id FROM incoming_calls_by_user WHERE callee_id=? AND ring_deadline");
        verify(prepared.get(first)).bind(call.calleeId(), now, 1);
        verify(prepared.get(first)).bind(call.calleeId(), now, 50);
    }

    @Test void datastoreFailuresAreNotConvertedToEmptyDiscovery() {
        when(session.execute(any(BoundStatement.class))).thenThrow(new IllegalStateException("index unavailable"));
        assertThatThrownBy(() -> incoming.page(call.calleeId(), now, null, 25)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> incoming.register(call)).isInstanceOf(IllegalStateException.class);
    }

    private Row row(Instant deadline, UUID room, UUID id) {
        var row = mock(Row.class);
        when(row.getInstant("ring_deadline")).thenReturn(deadline);
        when(row.getUuid("conversation_id")).thenReturn(room);
        when(row.getUuid("call_id")).thenReturn(id);
        return row;
    }
}
