package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class MessageMentionRepositoryTest {
    private final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    private final PreparedStatement reference = mock(PreparedStatement.class);
    private final PreparedStatement inbox = mock(PreparedStatement.class);
    private final UUID room = UUID.randomUUID(), messageId = Uuids.timeBased(), sender = UUID.randomUUID();
    private final String bucket = "2026-11-04-08:00";
    private final CanonicalMessage message = mock(CanonicalMessage.class);
    private final BoundStatement referenceWrite = mock(BoundStatement.class);
    private final BoundStatement inboxWrite = mock(BoundStatement.class);
    private final CassandraMessageRepository repository;

    MessageMentionRepositoryTest() {
        var unused = mock(PreparedStatement.class);
        var keyspace = mock(KeyspaceMetadata.class);
        var attachmentRef = mock(UserDefinedType.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(attachmentRef));
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            if (query.contains("INSERT INTO message_mentions_by_message")) return reference;
            if (query.contains("INSERT INTO mentioned_messages_by_user")) {
                assertThat(query).doesNotContain("now()");
                return inbox;
            }
            return unused;
        });
        repository = new CassandraMessageRepository(session);
        when(message.conversationId()).thenReturn(room);
        when(message.messageId()).thenReturn(messageId);
        when(message.senderId()).thenReturn(sender);
        when(message.messageBucket()).thenReturn(bucket);
    }

    @Test
    void inboxWritesUseTheCommittedMessageTimeuuidOnEveryAttempt() {
        UUID recipient = UUID.randomUUID();
        when(reference.bind(room, bucket, messageId, recipient)).thenReturn(referenceWrite);
        when(inbox.bind(recipient, messageId, room, bucket, messageId, sender)).thenReturn(inboxWrite);

        repository.saveMentions(message, Set.of(recipient));
        repository.saveMentions(message, Set.of(recipient));

        var batches = org.mockito.ArgumentCaptor.forClass(BatchStatement.class);
        verify(session, times(2)).execute(batches.capture());
        for (var batch : batches.getAllValues()) assertThat(batch).containsExactly(referenceWrite, inboxWrite);
        verify(inbox, times(2)).bind(recipient, messageId, room, bucket, messageId, sender);
    }

    @Test
    void inboxAndReferenceWritesStayBoundedAndIncludeEveryRecipient() {
        var recipients = recipientsAcrossTwoBatches();
        when(reference.bind(any(Object[].class))).thenReturn(referenceWrite);
        when(inbox.bind(any(Object[].class))).thenReturn(inboxWrite);

        repository.saveMentions(message, recipients);

        var batches = org.mockito.ArgumentCaptor.forClass(BatchStatement.class);
        verify(session, times(2)).execute(batches.capture());
        assertThat(batches.getAllValues()).extracting(BatchStatement::size).containsExactly(16, 2);
        for (UUID recipient : recipients) {
            verify(reference).bind(room, bucket, messageId, recipient);
            verify(inbox).bind(recipient, messageId, room, bucket, messageId, sender);
        }
    }

    @Test
    void repairStaysBoundedAndNeverAddsInboxRowsForLegacyMessages() {
        var recipients = recipientsAcrossTwoBatches();
        when(reference.bind(any(Object[].class))).thenReturn(referenceWrite);

        repository.repairMentionReferences(message, recipients);

        var batches = org.mockito.ArgumentCaptor.forClass(BatchStatement.class);
        verify(session, times(2)).execute(batches.capture());
        assertThat(batches.getAllValues()).extracting(BatchStatement::size).containsExactly(8, 1);
        verifyNoInteractions(inbox);
    }

    private static Set<UUID> recipientsAcrossTwoBatches() {
        return IntStream.range(0, 9).mapToObj(value -> new UUID(0, value)).collect(Collectors.toSet());
    }
}
