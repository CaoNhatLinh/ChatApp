package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CassandraCallRepositoryTest {
    final CqlSession session = mock(CqlSession.class);
    final Map<String, PreparedStatement> prepared = new LinkedHashMap<>();
    final Map<String, BoundStatement> bound = new LinkedHashMap<>();
    final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    final ResultSet result = mock(ResultSet.class);
    final CallWorkRepository work = mock(CallWorkRepository.class);
    final IncomingCallRepository incoming = mock(IncomingCallRepository.class);
    final CallHistoryRepository history = mock(CallHistoryRepository.class);
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    final CallState call = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), CallState.Type.VIDEO, now, UUID.randomUUID());
    final CallRepository.Slot slot = new CallRepository.Slot(UUID.randomUUID(), null);
    final CassandraCallRepository calls;

    CassandraCallRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String cql = invocation.getArgument(0);
            var query = mock(PreparedStatement.class);
            var statement = mock(BoundStatement.class, RETURNS_SELF);
            when(query.bind(any(Object[].class))).thenReturn(statement);
            prepared.put(cql, query); bound.put(cql, statement); return query;
        });
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        when(result.wasApplied()).thenReturn(true);
        calls = new CassandraCallRepository(session, mapper, work, incoming, history);
    }
    String query(String prefix) { return prepared.keySet().stream().filter(key -> key.startsWith(prefix)).findFirst().orElseThrow(); }

    @Test void claimPrewritesIncomingAndFencedExpiryBeforeAtomicSlotAndSnapshot() throws Exception {
        assertThat(calls.claim(slot, call)).isTrue();
        String claim = query("BEGIN BATCH UPDATE");
        assertThat(claim).contains("IF revision=? AND active_call_id=null", "IF NOT EXISTS", "call_id=00000000-0000-0000-0000-000000000000");
        assertThat(claim).doesNotContain("call_expiry_by_hour");
        verify(prepared.get(claim)).bind(call.revision(), call.callId(), call.conversationId(), slot.revision(), call.conversationId(), call.callId(), call.revision(), mapper.writeValueAsString(call));
        var order = inOrder(history, incoming, work, session);
        order.verify(history).register(call); order.verify(incoming).register(call); order.verify(work).register(slot, call); order.verify(session).execute(bound.get(claim));
        assertThat(claim).contains("published_version", "VALUES (?,?,?,?,0)");
        verify(bound.get(claim)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(bound.get(claim)).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        verify(bound.get(claim)).setIdempotent(false);
    }
    @Test void failedExpiryRegistrationCannotCommitAnUndiscoverableCall() {
        String claim = query("BEGIN BATCH UPDATE");
        doThrow(new IllegalStateException("index unavailable")).when(work).register(slot, call);
        assertThatThrownBy(() -> calls.claim(slot, call)).isInstanceOf(IllegalStateException.class);
        verify(session, never()).execute(bound.get(claim));
        verify(incoming).register(call);
    }
    @Test void failedIncomingRegistrationCannotReachWorkOrAuthorityCas() {
        doThrow(new IllegalStateException("incoming index unavailable")).when(incoming).register(call);
        assertThatThrownBy(() -> calls.claim(slot, call)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(work);
        verify(session, never()).execute(any(BoundStatement.class));
    }
    @Test void failedHistoryRegistrationCannotReachIncomingWorkOrAuthorityCas() {
        doThrow(new IllegalStateException("history unavailable")).when(history).register(call);
        assertThatThrownBy(() -> calls.claim(slot, call)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(incoming, work);
        verify(session, never()).execute(any(BoundStatement.class));
    }
    @Test void terminalMutationFencesBothRowsAndClearsOnlyItsOwnSlot() throws Exception {
        var ended = call.apply(call.callerId(), CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        String update = prepared.keySet().stream().filter(sql -> sql.contains("UPDATE call_state_by_conversation SET revision=?,snapshot_json=?")).findFirst().orElseThrow();
        var activeSlot = new CallRepository.Slot(call.revision(), call.callId());
        assertThat(calls.change(activeSlot, call, ended)).isTrue();
        verify(prepared.get(update)).bind(ended.revision(), null, call.conversationId(), activeSlot.revision(), call.callId(), ended.revision(), mapper.writeValueAsString(ended), call.conversationId(), call.callId(), call.revision());
        var order = inOrder(work, session); order.verify(work).register(activeSlot, ended); order.verify(session).execute(bound.get(update));
        verifyNoInteractions(incoming, history);
        assertThat(update).contains("IF revision=? AND active_call_id=?", "IF revision=?; APPLY BATCH");
    }
    @Test void losingClaimRetainsItsFalsePositiveDiscoveryKey() {
        when(result.wasApplied()).thenReturn(false);
        assertThat(calls.claim(slot, call)).isFalse();
        verify(incoming).register(call);
        verify(history).register(call);
        verify(work).register(slot, call);
        verifyNoMoreInteractions(incoming);
    }
    @Test void uncertainClaimRetryPrewritesTheSameKeyBeforeEachAuthorityAttempt() {
        String claim = query("BEGIN BATCH UPDATE");
        when(session.execute(bound.get(claim))).thenThrow(new IllegalStateException("authority outcome unknown")).thenReturn(result);
        assertThatThrownBy(() -> calls.claim(slot, call)).isInstanceOf(IllegalStateException.class);
        assertThat(calls.claim(slot, call)).isTrue();
        var order = inOrder(history, incoming, work, session);
        for (int attempt = 0; attempt < 2; attempt++) {
            order.verify(history).register(call);
            order.verify(incoming).register(call);
            order.verify(work).register(slot, call);
            order.verify(session).execute(bound.get(claim));
        }
        verifyNoMoreInteractions(incoming);
    }
    @Test void heartbeatMutationDoesNotRewriteTheIncomingKey() {
        var heartbeat = call.apply(call.callerId(), CallState.Action.HEARTBEAT, now.plusSeconds(1), UUID.randomUUID());
        assertThat(calls.change(new CallRepository.Slot(call.revision(), call.callId()), call, heartbeat)).isTrue();
        verifyNoInteractions(incoming, history);
    }
    @Test void snapshotRoundTripsWithoutSignalsOrImplicitMediaState() throws Exception {
        String find = query("SELECT snapshot_json");
        var row = mock(Row.class); when(result.one()).thenReturn(row);
        when(row.getString("snapshot_json")).thenReturn(mapper.writeValueAsString(call));
        assertThat(calls.find(call.conversationId(), call.callId())).isEqualTo(call);
        verify(prepared.get(find)).bind(call.conversationId(), call.callId());
        assertThat(mapper.writeValueAsString(call)).doesNotContain("signal", "sdp", "ice", "mediaConnected");
        when(row.getString("snapshot_json")).thenReturn("not json");
        assertThatThrownBy(() -> calls.find(call.conversationId(), call.callId())).isInstanceOf(IllegalStateException.class);
    }
    @Test void bootstrapCannotResetSlot() {
        calls.initialize(call.conversationId());
        assertThat(query("INSERT INTO call_state")).endsWith("IF NOT EXISTS");
    }
    @Test void publicationReadsAuthorityAndAdvancesOnlyExactRevisionAndPreviousReceipt() throws Exception {
        var row = mock(Row.class); when(result.one()).thenReturn(row);
        when(row.getString("snapshot_json")).thenReturn(mapper.writeValueAsString(call));
        when(row.getLong("published_version")).thenReturn(0L);
        assertThat(calls.publication(call.conversationId(), call.callId())).isEqualTo(new CallRepository.Publication(call, 0));
        assertThat(calls.markPublished(call, 0)).isTrue();
        String update = query("UPDATE call_state_by_conversation SET published_version");
        assertThat(update).contains("IF revision=? AND published_version=?");
        verify(prepared.get(update)).bind(call.version(), call.conversationId(), call.callId(), call.revision(), 0L);
        when(result.wasApplied()).thenReturn(false);
        assertThat(calls.markPublished(call, 0)).isFalse();
        assertThatThrownBy(() -> calls.markPublished(call, call.version())).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void lateProducerFenceCannotClearOrReplaceActiveCall() {
        var expected = new CallRepository.Slot(UUID.randomUUID(), call.callId());
        UUID next = UUID.randomUUID();
        assertThat(calls.fenceSlot(call.conversationId(), expected, next)).isTrue();
        String update = query("UPDATE call_state_by_conversation SET revision=? WHERE");
        assertThat(update).contains("IF revision=? AND active_call_id=?").doesNotContain("SET active_call_id");
        verify(prepared.get(update)).bind(next, call.conversationId(), expected.revision(), call.callId());
        when(result.wasApplied()).thenReturn(false);
        assertThat(calls.fenceSlot(call.conversationId(), expected, next)).isFalse();
        assertThatThrownBy(() -> calls.fenceSlot(call.conversationId(), expected, expected.revision())).isInstanceOf(IllegalArgumentException.class);
    }
}
