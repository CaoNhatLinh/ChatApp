package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageReplyRepositoryTest {
    @Test void parentIndexRepairFollowsConditionalAuthorityAndKeepsSameIndexIdentity() {
        var session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        var other = mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
        var reply = mock(PreparedStatement.class);
        var replyStatement = mock(BoundStatement.class);
        when(replyStatement.setConsistencyLevel(any())).thenReturn(replyStatement);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("INSERT INTO replies_by_parent_message"))).thenReturn(reply);
        when(reply.bind(any(Object[].class))).thenReturn(replyStatement);
        when(session.execute(any(BoundStatement.class)).wasApplied()).thenReturn(true);
        var repository = new CassandraMessageRepository(session);
        UUID room = UUID.randomUUID(), parent = Uuids.timeBased(), child = Uuids.timeBased(), actor = UUID.randomUUID();
        Instant created = Instant.parse("2026-10-20T09:00:00.123Z");
        var message = new CanonicalMessage(room, "2026-10-20-09:02", child, actor, "TEXT", "reply", "PLAIN",
                parent, UUID.randomUUID(), null, null, null, null, null, null, false, null, null, null,
                false, false, false, created, UUID.randomUUID(), null, "2026-10-20-08:03", 0);
        assertThat(repository.createIfAbsent(message)).isTrue();
        verify(session, never()).execute(any(BatchStatement.class));
        verify(reply, never()).bind(any(Object[].class));
        repository.repairSourceProjections(message);
        repository.repairSourceProjections(message);
        verify(reply, times(2)).bind(room, "2026-10-20-08:03", parent, Uuids.startOf(created.toEpochMilli()),
                message.messageBucket(), child, actor);
        verify(session, times(2)).execute(replyStatement);
        verify(replyStatement, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }
}
