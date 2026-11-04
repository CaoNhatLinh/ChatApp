package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageCreationRepositoryTest {
    final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    final PreparedStatement create = mock(PreparedStatement.class);
    final BoundStatement statement = mock(BoundStatement.class, RETURNS_SELF);
    final ResultSet result = mock(ResultSet.class);
    final List<String> queries = new ArrayList<>();
    final CassandraMessageRepository repository;
    MessageCreationRepositoryTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0); queries.add(query);
            return query.contains("INSERT INTO messages_by_conversation_bucket") ? create : mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
        });
        when(create.bind(any(Object[].class))).thenReturn(statement);
        when(session.execute(statement)).thenReturn(result);
        repository = new CassandraMessageRepository(session);
    }
    @Test void initialAuthorityCreationIsConditionalAndSerial() {
        when(result.wasApplied()).thenReturn(true);
        var message = mock(CanonicalMessage.class);
        when(message.createdAt()).thenReturn(java.time.Instant.now());
        assertThat(repository.createIfAbsent(message)).isTrue();
        assertThat(queries.stream().filter(query -> query.contains("INSERT INTO messages_by_conversation_bucket")).toList())
                .singleElement().asString().contains("IF NOT EXISTS");
        verify(statement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(statement).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        verify(result).wasApplied();
        verify(session).execute(any(BoundStatement.class));
        verify(session, never()).execute(any(BatchStatement.class));
    }
    @Test void lostOrFailedCreationDoesNotWriteProjectionsOrRetryUnconditionally() {
        when(result.wasApplied()).thenReturn(false);
        assertThat(repository.createIfAbsent(mock(CanonicalMessage.class))).isFalse();
        verify(session).execute(statement);
        verify(session).execute(any(BoundStatement.class));
        verify(session, never()).execute(any(BatchStatement.class));
        doThrow(new IllegalStateException("ambiguous conditional write")).when(session).execute(statement);
        assertThatThrownBy(() -> repository.createIfAbsent(mock(CanonicalMessage.class))).isInstanceOf(IllegalStateException.class);
        verify(session, times(2)).execute(statement);
    }
}
