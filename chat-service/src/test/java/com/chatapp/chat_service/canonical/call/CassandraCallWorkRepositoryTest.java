package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CassandraCallWorkRepositoryTest {
    final CqlSession session = mock(CqlSession.class);
    final Map<String, PreparedStatement> prepared = new LinkedHashMap<>();
    final Map<String, BoundStatement> bound = new LinkedHashMap<>();
    final ResultSet result = mock(ResultSet.class);
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    final CallState call = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), CallState.Type.VOICE, now, UUID.randomUUID());
    final CallRepository.Slot slot = new CallRepository.Slot(UUID.randomUUID(), null);
    final CassandraCallWorkRepository work;
    CassandraCallWorkRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String cql = invocation.getArgument(0); var query = mock(PreparedStatement.class);
            var statement = mock(BoundStatement.class, RETURNS_SELF);
            when(query.bind(any(Object[].class))).thenReturn(statement); prepared.put(cql, query); bound.put(cql, statement); return query;
        });
        when(session.execute(any(BoundStatement.class))).thenReturn(result); when(result.wasApplied()).thenReturn(true);
        work = new CassandraCallWorkRepository(session, Clock.fixed(now, ZoneOffset.UTC));
    }
    String query(String prefix) { return prepared.keySet().stream().filter(sql -> sql.startsWith(prefix)).findFirst().orElseThrow(); }
    @Test void prewritesPublicationAndExpiryWithTheSameAuthorityFence() {
        work.register(slot, call);
        var insert = prepared.get(query("INSERT INTO call_work_by_shard"));
        verify(insert).bind(CallWorkRepository.shard(call.conversationId()), Instant.EPOCH, call.conversationId(), call.callId(), call.revision(), "PUBLISH", call.deadline(), slot.revision(), now.plusSeconds(30));
        verify(insert).bind(CallWorkRepository.shard(call.conversationId()), call.deadline(), call.conversationId(), call.callId(), call.revision(), "EXPIRE", call.deadline(), slot.revision(), now.plusSeconds(30));
    }
    @Test void terminalPrewriteStillRetainsPublicationRecovery() {
        var ended = call.apply(call.callerId(), CallState.Action.END, now.plusSeconds(1), UUID.randomUUID()); work.register(slot, ended);
        verify(prepared.get(query("INSERT INTO call_work_by_shard"))).bind(CallWorkRepository.shard(call.conversationId()), Instant.EPOCH, call.conversationId(), call.callId(), ended.revision(), "PUBLISH", call.deadline(), slot.revision(), now.plusSeconds(30));
        verify(session).execute(bound.get(query("INSERT INTO call_work_by_shard")));
    }
    @Test void boundedPagingIncludesKindInTheCompleteTuple() {
        var key = new CallWorkRepository.Key(Instant.EPOCH, call.conversationId(), call.callId(), call.revision(), CallWorkRepository.Kind.PUBLISH);
        when(result.iterator()).thenAnswer(ignored -> Collections.emptyIterator());
        assertThat(work.page(3, key, now, 25)).isEmpty();
        String after = prepared.keySet().stream().filter(sql -> sql.startsWith("SELECT * FROM call_work_by_shard") && sql.contains(" > ")).findFirst().orElseThrow();
        var max = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
        verify(prepared.get(after)).bind(3, Instant.EPOCH, call.conversationId(), call.callId(), call.revision(), "PUBLISH", now, max, max, max, "zz", 25);
        assertThat(after).contains("(due_at,conversation_id,call_id,revision,kind) > (?,?,?,?,?)", "LIMIT ?").doesNotContain("ALLOW FILTERING");
        assertThatThrownBy(() -> work.page(16, null, now, 25)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> work.page(0, null, now, 102)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void exactRemovalDoesNotDeleteAnotherRevisionOrStage() {
        var key = new CallWorkRepository.Key(call.deadline(), call.conversationId(), call.callId(), call.revision(), CallWorkRepository.Kind.EXPIRE); work.remove(key);
        verify(prepared.get(query("DELETE FROM call_work_by_shard"))).bind(CallWorkRepository.shard(call.conversationId()), call.deadline(), call.conversationId(), call.callId(), call.revision(), "EXPIRE");
    }
    @Test void checkpointWrapClearsAllCursorFieldsUnderCas() {
        var expected = new CallWorkRepository.Progress(UUID.randomUUID(), null); assertThat(work.advance(2, expected, null)).isTrue();
        verify(prepared.get(query("UPDATE call_work_progress"))).bind(any(UUID.class), isNull(), isNull(), isNull(), isNull(), isNull(), eq(2), eq(expected.revision()));
        when(result.wasApplied()).thenReturn(false); assertThat(work.advance(2, expected, null)).isFalse();
    }
    @Test void checkpointInitializationCannotResetExistingProgress() {
        var row = mock(Row.class); UUID revision = UUID.randomUUID();
        when(result.one()).thenReturn(null, row); when(row.getUuid("revision")).thenReturn(revision);
        assertThat(work.progress(4)).isEqualTo(new CallWorkRepository.Progress(revision, null));
        assertThat(query("INSERT INTO call_work_progress")).endsWith("IF NOT EXISTS");
        verify(prepared.get(query("SELECT * FROM call_work_progress")), times(2)).bind(4);
    }
}
