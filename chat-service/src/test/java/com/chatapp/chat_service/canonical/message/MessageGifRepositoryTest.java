package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageGifRepositoryTest {
    @Test void savesProviderColumnsAndHydratesTypedReferenceWithoutMediaUrls() {
        CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        var other = mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
        var save = mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
        var load = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("INSERT INTO messages_by_conversation_bucket"))).thenReturn(save);
        when(session.prepare(contains("AND message_id = ?"))).thenReturn(load);
        var repository = new CassandraMessageRepository(session);
        UUID room = UUID.randomUUID(), actor = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        Instant at = Instant.now();
        String bucket = "2026-10-20-08:00";
        var reference = new GifReference("GIPHY", "abc123");
        var message = new CanonicalMessage(room, bucket, id, actor, "GIF", "", "PLAIN", null, null, null, null,
                null, null, null, null, false, null, null, null, false, false, false, at, client, reference, null, 0);
        when(session.execute(any(BoundStatement.class)).wasApplied()).thenReturn(true);
        assertThat(repository.createIfAbsent(message)).isTrue();
        verify(save).bind(room, bucket, id, actor, "GIF", "", "PLAIN", null, null, null, null, null, null, null,
                null, false, null, null, null, false, false, false, at, client, "GIPHY", "abc123", null);
        var query = mock(BoundStatement.class);
        when(query.setConsistencyLevel(any())).thenReturn(query);
        var result = mock(ResultSet.class);
        var row = mock(Row.class);
        when(load.bind(room, bucket, id)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        when(result.one()).thenReturn(row);
        when(row.getString("gif_provider")).thenReturn("GIPHY");
        when(row.getString("gif_id")).thenReturn("abc123");
        assertThat(repository.find(room, bucket, id).gif()).isEqualTo(reference);
        when(row.getString("gif_provider")).thenReturn(null);
        when(row.getString("gif_id")).thenReturn(null);
        assertThat(repository.find(room, bucket, id).gif()).isNull();
    }
}
