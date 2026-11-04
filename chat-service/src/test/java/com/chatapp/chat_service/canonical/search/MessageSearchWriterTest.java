package com.chatapp.chat_service.canonical.search;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import java.time.Instant;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageSearchWriterTest {
    @Test void buildsOneAtomicScriptedUpsertWithBoundedConflictRetryAndSeparateMetadata() {
        var operations = mock(ElasticsearchOperations.class);
        var index = IndexCoordinates.of("configured-message-index");
        when(operations.getIndexCoordinatesFor(MessageSearchDocument.class)).thenReturn(index);
        var message = snapshot(7, true);
        new MessageSearchWriterImpl(operations).upsertSnapshot(message, false, false);
        var query = ArgumentCaptor.forClass(UpdateQuery.class);
        verify(operations).update(query.capture(), eq(index));
        assertThat(query.getValue().getScriptedUpsert()).isTrue();
        assertThat(query.getValue().getRetryOnConflict()).isEqualTo(3);
        assertThat(query.getValue().getUpsert()).isEmpty();
        assertThat(query.getValue().getScript()).isEqualTo(MessageSearchWriterImpl.SCRIPT);
        var fields = (Map<?, ?>) query.getValue().getParams().get("snapshot");
        assertThat(fields.get("revision")).isEqualTo(7);
        assertThat(fields.get("content")).isEqualTo("");
        assertThat(fields.get("hasAttachments")).isEqualTo(false);
        assertThat(fields.containsKey("isPinned")).isFalse();
        assertThat(fields.containsKey("mentionedUserIds")).isFalse();
        verify(operations).getIndexCoordinatesFor(MessageSearchDocument.class);
        verifyNoMoreInteractions(operations);
    }
    static MessageSearchDocument snapshot(int revision, boolean deleted) {
        var message = new MessageSearchDocument();
        message.setId("room:bucket:message"); message.setMessageId("message");
        message.setConversationId("room"); message.setMessageBucket("bucket");
        message.setSenderId("sender"); message.setMessageType("TEXT");
        message.setContent("revision-" + revision); message.setRevision(revision);
        message.setDeleted(deleted); message.setHasAttachments(true);
        message.setCreatedAt(Instant.parse("2026-10-23T08:00:00Z"));
        return message;
    }
}
