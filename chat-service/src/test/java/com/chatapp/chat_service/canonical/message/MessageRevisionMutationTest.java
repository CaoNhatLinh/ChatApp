package com.chatapp.chat_service.canonical.message;

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

class MessageRevisionMutationTest {
    final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    final Row row = mock(Row.class);
    final PreparedStatement read = mock(PreparedStatement.class), edit = mock(PreparedStatement.class), delete = mock(PreparedStatement.class);
    final BoundStatement readBound = mock(BoundStatement.class, RETURNS_SELF), writeBound = mock(BoundStatement.class, RETURNS_SELF);
    final UUID room = UUID.randomUUID(), id = UUID.randomUUID(), actor = UUID.randomUUID();
    final String bucket = "2026-10-23-08:00";
    final CassandraMessageRepository repository;
    MessageRevisionMutationTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(mock(PreparedStatement.class, RETURNS_DEEP_STUBS));
        when(session.prepare(contains("SELECT content, sender_id, is_deleted, revision_no"))).thenReturn(read);
        when(session.prepare(contains("SET content = ?, edited_at = ?, revision_no = ?"))).thenReturn(edit);
        when(session.prepare(contains("SET is_deleted = true, deleted_by = ?, deleted_at = ?, revision_no = ?"))).thenReturn(delete);
        when(read.bind(room, bucket, id)).thenReturn(readBound);
        when(session.execute(readBound).one()).thenReturn(row);
        when(edit.bind(any(Object[].class))).thenReturn(writeBound);
        when(delete.bind(any(Object[].class))).thenReturn(writeBound);
        when(session.execute(writeBound).wasApplied()).thenReturn(true);
        repository = new CassandraMessageRepository(session);
    }
    @Test void missingOrNegativeRevisionCannotEnterMutationCas() {
        when(row.isNull("revision_no")).thenReturn(true);
        assertThatThrownBy(() -> repository.updateContent(room, bucket, id, "new", actor)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> repository.delete(room, bucket, id, actor)).isInstanceOf(IllegalStateException.class);
        when(row.isNull("revision_no")).thenReturn(false); when(row.getInt("revision_no")).thenReturn(-1);
        assertThatThrownBy(() -> repository.updateContent(room, bucket, id, "new", actor)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> repository.delete(room, bucket, id, actor)).isInstanceOf(IllegalStateException.class);
        verify(edit, never()).bind(any(Object[].class)); verify(delete, never()).bind(any(Object[].class));
    }
    @Test void exhaustedRevisionCannotWrapNegativeOrWrite() {
        when(row.getInt("revision_no")).thenReturn(Integer.MAX_VALUE);
        assertThatThrownBy(() -> repository.updateContent(room, bucket, id, "new", actor)).isInstanceOf(ArithmeticException.class);
        assertThatThrownBy(() -> repository.delete(room, bucket, id, actor)).isInstanceOf(ArithmeticException.class);
        verify(edit, never()).bind(any(Object[].class)); verify(delete, never()).bind(any(Object[].class));
    }
    @Test void mutationsBindNextRevisionAndExactExpectedPrior() {
        when(row.getInt("revision_no")).thenReturn(7);
        assertThat(repository.updateContent(room, bucket, id, "new", actor)).isTrue();
        assertThat(repository.delete(room, bucket, id, actor)).isTrue();
        verify(edit).bind(eq("new"), any(), eq(8), eq(room), eq(bucket), eq(id), eq(7));
        verify(delete).bind(eq(actor), any(), eq(8), eq(room), eq(bucket), eq(id), eq(7));
    }
    @Test void tombstoneVisibilityUsesExplicitQuorumAndLocalSerialCas() {
        when(row.getInt("revision_no")).thenReturn(7);
        assertThat(repository.delete(room, bucket, id, actor)).isTrue();
        verify(readBound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(writeBound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(writeBound).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }
}
