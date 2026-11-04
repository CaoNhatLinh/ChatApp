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

class MessageForwardRepositoryTest {
    @Test void sourceIndexRepairFollowsConditionalAuthorityAndKeepsStableIdentity() {
        var session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(mock(PreparedStatement.class, RETURNS_DEEP_STUBS));
        var forward = mock(PreparedStatement.class);
        var statement = mock(BoundStatement.class);
        when(statement.setConsistencyLevel(any())).thenReturn(statement);
        when(session.prepare(contains("INSERT INTO message_forwards_by_source_message"))).thenReturn(forward);
        when(forward.bind(any(Object[].class))).thenReturn(statement);
        when(session.execute(any(BoundStatement.class)).wasApplied()).thenReturn(true);
        var repository = new CassandraMessageRepository(session);
        UUID sourceRoom = UUID.randomUUID(), sourceId = Uuids.timeBased(), targetRoom = UUID.randomUUID(), targetId = Uuids.timeBased();
        Instant created = Instant.parse("2026-10-20T09:00:00.123Z");
        var message = new CanonicalMessage(targetRoom, "2026-10-20-09:02", targetId, UUID.randomUUID(), "TEXT", "copy", "PLAIN",
                null, null, null, null, null, sourceRoom, "2026-10-20-08:03", sourceId, false, null, null, null,
                false, false, false, created, UUID.randomUUID(), null, null, 0);
        assertThat(repository.createIfAbsent(message)).isTrue();
        verify(session, never()).execute(any(BatchStatement.class));
        verify(forward, never()).bind(any(Object[].class));
        repository.repairSourceProjections(message);
        repository.repairSourceProjections(message);
        verify(forward, times(2)).bind(sourceRoom, "2026-10-20-08:03", sourceId, Uuids.startOf(created.toEpochMilli()),
                targetRoom, message.messageBucket(), targetId, message.senderId());
        verify(session, times(2)).execute(statement);
        verify(statement, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }
}
