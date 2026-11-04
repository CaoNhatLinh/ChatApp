package com.chatapp.chat_service.canonical.message;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CassandraMessageClaimTest {
    final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    final PreparedStatement read = mock(PreparedStatement.class), write = mock(PreparedStatement.class);
    final BoundStatement bound = mock(BoundStatement.class);
    final ResultSet result = mock(ResultSet.class);
    final Row row = mock(Row.class);
    final UUID actor = UUID.randomUUID(), client = UUID.randomUUID(), room = UUID.randomUUID(), message = UUID.randomUUID();
    CassandraMessageRepository repository;
    @BeforeEach void setup() {
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(write);
        when(session.prepare(contains("FROM message_id_by_client_id"))).thenReturn(read);
        when(read.bind(actor, client)).thenReturn(bound);
        when(bound.setConsistencyLevel(any())).thenReturn(bound);
        when(session.execute(bound)).thenReturn(result);
        repository = new CassandraMessageRepository(session);
    }
    @Test void missingReadDoesNotReserveAnIdentity() {
        assertThat(repository.findClaim(actor, client, room, "hash")).isNull();
        verify(bound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(write, never()).bind(any(Object[].class));
    }
    @Test void newClaimUsesQuorumAndLocalSerial() {
        BoundStatement insertion = mock(BoundStatement.class);
        ResultSet inserted = mock(ResultSet.class);
        when(write.bind(any(Object[].class))).thenReturn(insertion);
        when(insertion.setConsistencyLevel(any())).thenReturn(insertion);
        when(insertion.setSerialConsistencyLevel(any())).thenReturn(insertion);
        when(session.execute(insertion)).thenReturn(inserted);
        when(inserted.wasApplied()).thenReturn(true);
        var claim = repository.claim(actor, client, room, "2026-10-12-01:00", "hash", Instant.EPOCH);
        assertThat(claim.claimed()).isTrue();
        verify(insertion).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(insertion).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }
    @Test void collisionReturnsOriginalClaimAndChecksPayloadWithoutAllocatingAnotherRow() {
        BoundStatement insertion = mock(BoundStatement.class);
        ResultSet inserted = mock(ResultSet.class);
        when(write.bind(any(Object[].class))).thenReturn(insertion);
        when(insertion.setConsistencyLevel(any())).thenReturn(insertion);
        when(insertion.setSerialConsistencyLevel(any())).thenReturn(insertion);
        when(session.execute(insertion)).thenReturn(inserted);
        when(result.one()).thenReturn(row);
        when(row.getUuid("conversation_id")).thenReturn(room);
        when(row.getUuid("message_id")).thenReturn(message);
        when(row.getString("message_bucket")).thenReturn("2026-10-12-01:00");
        when(row.getString("request_fingerprint")).thenReturn("hash");
        when(row.getInstant("created_at")).thenReturn(Instant.EPOCH);
        var claim = repository.claim(actor, client, room, "2026-10-13-02:01", "hash", Instant.now());
        assertThat(claim.messageId()).isEqualTo(message);
        assertThat(claim.messageBucket()).isEqualTo("2026-10-12-01:00");
        assertThat(claim.claimed()).isFalse();
        assertThat(claim.matchesRequest()).isTrue();
        verify(session, times(1)).execute(insertion);
    }
    @Test void existingReadChecksBothConversationAndFingerprint() {
        when(result.one()).thenReturn(row);
        when(row.getUuid("conversation_id")).thenReturn(room);
        when(row.getUuid("message_id")).thenReturn(message);
        when(row.getString("message_bucket")).thenReturn("2026-10-12-01:00");
        when(row.getString("request_fingerprint")).thenReturn("hash");
        when(row.getInstant("created_at")).thenReturn(Instant.EPOCH);
        assertThat(repository.findClaim(actor, client, room, "hash"))
                .isEqualTo(new MessageRepository.MessageClaim(message, "2026-10-12-01:00", Instant.EPOCH, false, true));
        assertThat(repository.findClaim(actor, client, room, "changed").matchesRequest()).isFalse();
        assertThat(repository.findClaim(actor, client, UUID.randomUUID(), "hash").matchesRequest()).isFalse();
    }
}
