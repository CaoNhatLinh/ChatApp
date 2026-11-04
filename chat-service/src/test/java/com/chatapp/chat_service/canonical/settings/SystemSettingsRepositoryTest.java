package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.datastax.oss.driver.api.core.*;
import com.datastax.oss.driver.api.core.cql.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SystemSettingsRepositoryTest {
    private final CqlSession session = mock(CqlSession.class);
    private final BoundStatement statement = mock(BoundStatement.class, RETURNS_SELF);
    private final ResultSet result = mock(ResultSet.class);
    private final List<String> queries = new ArrayList<>();
    private final Map<String, PreparedStatement> prepared = new HashMap<>();
    private final CassandraSystemSettingsRepository repository;
    SystemSettingsRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(call -> {
            String query = call.getArgument(0); queries.add(query);
            var queryStatement = mock(PreparedStatement.class);
            when(queryStatement.bind(any(Object[].class))).thenReturn(statement);
            prepared.put(query, queryStatement);
            return queryStatement;
        });
        when(session.execute(statement)).thenReturn(result);
        repository = new CassandraSystemSettingsRepository(session, new JacksonConfig().objectMapper());
    }
    @Test void firstWriteConditionallyCommitsStateAndAuditIntentInOnePartition() {
        var command = command(); when(result.wasApplied()).thenReturn(true);
        assertThat(repository.save(command, SystemSettingsRepository.PRISTINE_REVISION)).isTrue();
        String query = queries.stream().filter(q -> q.startsWith("BEGIN BATCH INSERT")).findFirst().orElseThrow();
        assertThat(query).contains("IF NOT EXISTS", "'STATE'", "'COMMAND'", "'PENDING'", "false");
        verify(prepared.get(query)).bind(eq(command.state().key()), eq(SystemSettingsRepository.PRISTINE_REVISION), eq("false"),
                eq(command.state().revision()), eq(command.actorId()), eq(command.state().updatedAt()),
                eq(command.state().key()), eq(command.commandId()), anyString(), eq(command.state().key()), eq(command.commandId()), anyString());
        verify(statement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(statement).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }
    @Test void laterWriteRequiresExactRevisionAndHasNoSideWriteAfterLosingCas() {
        var command = command(); UUID prior = UUID.randomUUID();
        assertThat(repository.save(command, prior)).isFalse();
        String query = queries.stream().filter(q -> q.startsWith("BEGIN BATCH UPDATE")).findFirst().orElseThrow();
        assertThat(query).contains("IF revision=?", "'COMMAND'", "'PENDING'");
        verify(prepared.get(query)).bind(eq("false"), eq(command.state().revision()), eq(command.actorId()), eq(command.state().updatedAt()),
                eq(command.state().key()), eq(SystemSettingsRepository.PRISTINE_REVISION), eq(prior),
                eq(command.state().key()), eq(command.commandId()), anyString(), eq(command.state().key()), eq(command.commandId()), anyString());
        verify(session, times(1)).execute(statement);
    }
    @Test void recoveryPageIsKeyScopedAndCursorBounded() {
        UUID after = UUID.randomUUID(); when(result.all()).thenReturn(List.of());
        assertThat(repository.pending("community.creationEnabled", after, 1000)).isEmpty();
        String query = queries.stream().filter(q -> q.contains("command_id>?" )).findFirst().orElseThrow();
        verify(prepared.get(query)).bind("community.creationEnabled", after, 25);
        assertThat(queries).allSatisfy(q -> assertThat(q).doesNotContain("ALLOW FILTERING"));
    }
    @Test void immutableCommandRoundTripPreservesAuditIdentityAndRejectsWrongPartition() throws Exception {
        var saved = command(); var row = mock(Row.class);
        when(result.one()).thenReturn(row);
        when(row.getString("command_json")).thenReturn(new JacksonConfig().objectMapper().writeValueAsString(saved));
        assertThat(repository.findCommand(saved.state().key(), saved.commandId())).isEqualTo(saved);
        assertThatThrownBy(() -> repository.findCommand("other.key", saved.commandId())).isInstanceOf(IllegalStateException.class);
    }
    @Test void persistedZeroRevisionIsNotAValidPristineState() {
        var row = mock(Row.class); when(result.one()).thenReturn(row);
        when(row.getUuid("revision")).thenReturn(SystemSettingsRepository.PRISTINE_REVISION);
        assertThatThrownBy(() -> repository.find("community.creationEnabled")).isInstanceOf(IllegalStateException.class);
    }
    private SystemSettingsRepository.Command command() {
        UUID id = UUID.randomUUID(), actor = UUID.randomUUID();
        var state = new SystemSettingsRepository.State("community.creationEnabled", "false", id, actor, Instant.now());
        var event = new CanonicalRoomAuditEvent(actor, "2026-10", UUID.randomUUID(), "SYSTEM_SETTING_UPDATED", "SYSTEM_SETTING",
                state.key(), null, null, "SUCCESS", "reason", Map.of(), Map.of(), id, null, null, state.updatedAt());
        return new SystemSettingsRepository.Command(id, actor, "fingerprint", state, event);
    }
}
