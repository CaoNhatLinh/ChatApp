package com.chatapp.chat_service.canonical.message;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageThreadRepositoryTest {
    @Test void boundedQueriesBindCompleteParentPartitionAndBothContinuationKeys() {
        var session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        var other = mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
        var first = mock(PreparedStatement.class);
        var after = mock(PreparedStatement.class);
        var firstQuery = mock(BoundStatement.class);
        var afterQuery = mock(BoundStatement.class);
        when(firstQuery.setConsistencyLevel(any())).thenReturn(firstQuery);
        when(afterQuery.setConsistencyLevel(any())).thenReturn(afterQuery);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("parent_message_id = ? LIMIT ?"))).thenReturn(first);
        when(session.prepare(contains("AND (created_at, message_id) > (?, ?) LIMIT ?"))).thenReturn(after);
        var repository = new CassandraMessageRepository(session);
        UUID room = UUID.randomUUID(), parent = Uuids.timeBased(), child = Uuids.timeBased(), created = Uuids.startOf(1_000);
        String bucket = "2026-10-20-08:03";
        when(first.bind(room, bucket, parent, 26)).thenReturn(firstQuery);
        when(after.bind(room, bucket, parent, created, child, 26)).thenReturn(afterQuery);
        var row = mock(Row.class);
        when(row.getUuid("created_at")).thenReturn(created);
        when(row.getUuid("message_id")).thenReturn(child);
        when(row.getString("message_bucket")).thenReturn("2026-10-20-09:04");
        var result = mock(ResultSet.class);
        when(result.all()).thenReturn(List.of(row));
        when(session.execute(firstQuery)).thenReturn(result);
        when(session.execute(afterQuery)).thenReturn(result);
        var expected = new MessageRepository.ReplyReference(created, child, "2026-10-20-09:04");
        assertThat(repository.findReplies(room, bucket, parent, null, 26)).containsExactly(expected);
        assertThat(repository.findReplies(room, bucket, parent, new MessageRepository.ReplyPosition(created, child), 26)).containsExactly(expected);
        verify(firstQuery).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(afterQuery).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }
}
