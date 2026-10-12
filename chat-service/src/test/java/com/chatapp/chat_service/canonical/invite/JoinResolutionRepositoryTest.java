package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.metadata.Metadata;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class JoinResolutionRepositoryTest {
    private final CqlSession session = mock(CqlSession.class);
    private final ResultSet result = mock(ResultSet.class);
    private final Row row = mock(Row.class);
    private final List<String> executed = new ArrayList<>();
    private final UUID conversation = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();
    private final UUID request = UUID.randomUUID();
    private final UUID actor = UUID.randomUUID();

    private void prepareSession() {
        Metadata metadata = mock(Metadata.class);
        KeyspaceMetadata keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata()).thenReturn(metadata);
        when(metadata.getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            PreparedStatement prepared = mock(PreparedStatement.class);
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                BoundStatement bound = mock(BoundStatement.class);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                return bound;
            });
            when(prepared.getQuery()).thenReturn(query);
            return prepared;
        });
        when(session.execute(any(BoundStatement.class))).thenAnswer(call -> {
            BoundStatement bound = call.getArgument(0);
            executed.add(bound.getPreparedStatement().getQuery());
            return result;
        });
        when(result.one()).thenReturn(row);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void expiredClaimCannotSwitchTheDecision(boolean community) {
        prepareSession();
        when(result.wasApplied()).thenReturn(false, true);
        when(row.getString("status")).thenReturn("APPROVING");
        when(row.getString("resolution_decision")).thenReturn("APPROVE");
        when(row.getUuid("request_id")).thenReturn(request);
        when(row.getUuid("resolved_by")).thenReturn(UUID.randomUUID());
        when(row.getInstant("resolution_lease_until")).thenReturn(Instant.EPOCH);

        boolean claimed = community
                ? new CanonicalCqlStore(session).claimCommunityJoinResolution(conversation, user, request, actor, "DECLINE")
                : new CassandraInviteRepository(session).claimResolution(conversation, user, request, actor, "DECLINE");

        assertThat(claimed).isFalse();
        assertThat(executed).hasSize(2); // initial CAS plus current state; no takeover mutation
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectedFinishDoesNotWriteProjections(boolean community) {
        prepareSession();
        when(result.wasApplied()).thenReturn(false);
        if (community) {
            CanonicalCqlStore store = new CanonicalCqlStore(session);
            assertThatThrownBy(() -> store.finishCommunityJoinResolution(conversation, user, request, "APPROVED", actor))
                    .isInstanceOf(ConflictException.class);
        } else {
            CassandraInviteRepository repository = new CassandraInviteRepository(session);
            assertThatThrownBy(() -> repository.finishResolution(conversation, user, request, "APPROVED", actor))
                    .isInstanceOf(ConflictException.class);
        }
        assertThat(executed).hasSize(1);
        String condition = executed.get(0).split("IF ")[1];
        assertThat(condition).contains("status = 'APPROVING'", "resolved_by = ?");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void expiredClaimCanBeContinuedWithTheSameDecision(boolean community) {
        prepareSession();
        when(result.wasApplied()).thenReturn(false, true);
        when(row.getString("status")).thenReturn("APPROVING");
        when(row.getString("resolution_decision")).thenReturn("APPROVE");
        when(row.getUuid("request_id")).thenReturn(request);
        when(row.getUuid("resolved_by")).thenReturn(UUID.randomUUID());
        when(row.getInstant("resolution_lease_until")).thenReturn(Instant.EPOCH);
        boolean claimed = community
                ? new CanonicalCqlStore(session).claimCommunityJoinResolution(conversation, user, request, actor, "APPROVE")
                : new CassandraInviteRepository(session).claimResolution(conversation, user, request, actor, "APPROVE");
        assertThat(claimed).isTrue();
        assertThat(executed.get(2).split("IF ")[1]).contains("resolution_decision = ?");
    }
}
