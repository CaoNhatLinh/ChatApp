package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.data.UdtValue;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageAttachmentRepositoryTest {
    final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    final PreparedStatement write = mock(PreparedStatement.class), read = mock(PreparedStatement.class), after = mock(PreparedStatement.class);
    final BoundStatement writeBound = mock(BoundStatement.class, RETURNS_SELF), readBound = mock(BoundStatement.class, RETURNS_SELF), afterBound = mock(BoundStatement.class, RETURNS_SELF);
    final UdtValue value = mock(UdtValue.class, RETURNS_SELF);
    final UUID room = UUID.randomUUID(), id = UUID.randomUUID(), attachmentId = UUID.randomUUID(), assetId = UUID.randomUUID();
    final String bucket = "2026-10-23-08:00";
    final CassandraMessageRepository repository;
    MessageAttachmentRepositoryTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        var type = mock(UserDefinedType.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(type));
        when(type.newValue()).thenReturn(value);
        when(session.prepare(anyString())).thenReturn(mock(PreparedStatement.class, RETURNS_DEEP_STUBS));
        when(session.prepare(contains("INSERT INTO message_attachments_by_message"))).thenReturn(write);
        when(session.prepare("SELECT attachment FROM message_attachments_by_message WHERE conversation_id=? AND message_bucket=? AND message_id=? LIMIT ?")).thenReturn(read);
        when(session.prepare("SELECT attachment FROM message_attachments_by_message WHERE conversation_id=? AND message_bucket=? AND message_id=? AND attachment_id>? LIMIT ?")).thenReturn(after);
        when(write.bind(any(Object[].class))).thenReturn(writeBound);
        when(read.bind(any(Object[].class))).thenReturn(readBound);
        when(after.bind(any(Object[].class))).thenReturn(afterBound);
        repository = new CassandraMessageRepository(session);
    }
    @Test void stableReferenceWriteAcknowledgesAtLocalQuorumAndPreservesMetadata() {
        var message = mock(CanonicalMessage.class);
        when(message.conversationId()).thenReturn(room); when(message.messageBucket()).thenReturn(bucket); when(message.messageId()).thenReturn(id);
        var attachment = new AttachmentRequest(attachmentId, assetId, "CLOUDINARY", "key", "photo.png", "image/png",
                64L, 100, 80, null, "https://cdn.example/small.png", false);
        repository.saveAttachment(message, attachment); repository.saveAttachment(message, attachment);
        verify(write, times(2)).bind(room, bucket, id, attachmentId, value);
        verify(value, times(2)).setUuid("asset_id", assetId);
        verify(value, times(2)).setInt("width", 100); verify(value, times(2)).setInt("height", 80);
        verify(value, times(2)).setLong("byte_size", 64L);
        verify(value, times(2)).setToNull("duration_ms");
        verify(writeBound, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(session, times(2)).execute(writeBound);
    }
    @Test void headAndContinuationReadsUseExactPartitionAndQuorum() {
        assertThat(repository.findAttachments(room, bucket, id, null, 26)).isEmpty();
        assertThat(repository.findAttachments(room, bucket, id, attachmentId, 26)).isEmpty();
        verify(read).bind(room, bucket, id, 26); verify(after).bind(room, bucket, id, attachmentId, 26);
        verify(readBound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(afterBound).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
    }
    @Test void failedReferenceWriteIsNotSwallowed() {
        when(session.execute(writeBound)).thenThrow(new IllegalStateException("write not acknowledged"));
        var message = mock(CanonicalMessage.class);
        var attachment = new AttachmentRequest(attachmentId, assetId, "CLOUDINARY", "key", "photo.png", "image/png",
                64L, null, null, null, null, false);
        assertThatThrownBy(() -> repository.saveAttachment(message, attachment)).isInstanceOf(IllegalStateException.class);
    }
}
