package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class CanonicalBackendServiceMessageTest {
    @Mock CanonicalCqlStore store;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtTokenProvider tokenProvider;
    @Mock CanonicalConversationRepository conversationRepository;
    @Mock ConversationAuthorizationService authorization;
    @Mock CanonicalEventRecorder eventRecorder;
    @Mock ChatPolicyService chatPolicy;
    @Mock SimpMessagingTemplate messaging;
    @Mock AdminConversationDirectoryRepository adminConversationDirectory;

    private CanonicalBackendService service;

    @BeforeEach
    void setUp() {
        service = new CanonicalBackendService(
                store, passwordEncoder, tokenProvider, conversationRepository, authorization, eventRecorder, chatPolicy,
                messaging, adminConversationDirectory);
        lenient().when(store.findConversation(any())).thenAnswer(invocation -> conversation(invocation.getArgument(0)));
        lenient().when(authorization.requireMember(any(), any())).thenAnswer(invocation ->
                new CanonicalConversationMember(
                        invocation.getArgument(0), invocation.getArgument(1), Set.of(), Instant.now(),
                        null, null, null, "INHERIT", null, null));
        lenient().when(store.findConversationMember(any(), any())).thenAnswer(invocation ->
                new CanonicalConversationMember(
                        invocation.getArgument(0), invocation.getArgument(1), Set.of(), Instant.now(),
                        null, null, null, "INHERIT", null, null));
        lenient().when(authorization.effectivePermissions(any(), any()))
                .thenReturn(Set.of(ConversationPermission.MESSAGE_SEND));
    }

    @Test
    void retryReturnsOriginalMessageWithoutWritingItAgain() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        String bucket = "2026-07-22-01:03";
        CanonicalMessage existing = message(conversationId, bucket, messageId, actorId, clientMessageId, createdAt);
        when(store.claimMessage(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new CanonicalCqlStore.MessageClaim(messageId, bucket, createdAt, false, true));
        when(store.findMessage(conversationId, bucket, messageId)).thenReturn(existing);

        CanonicalMessage result = service.sendMessage(actorId, conversationId, request(clientMessageId, "hello"));

        assertThat(result).isSameAs(existing);
        verify(store, never()).insertMessage(any(), any());
        verify(store).recordMessageBucket(existing);
        verify(eventRecorder, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void historyMergesActiveShardsInGlobalMessageOrder() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant hour = Instant.parse("2026-07-22T01:00:00Z");
        CanonicalMessage older = message(
                conversationId, "2026-07-22-01:01", Uuids.timeBased(), actorId, UUID.randomUUID(), hour.plusSeconds(10));
        CanonicalMessage newer = message(
                conversationId, "2026-07-22-01:09", Uuids.timeBased(), actorId, UUID.randomUUID(), hour.plusSeconds(20));
        when(store.listMessageBuckets(conversationId, null, 256)).thenReturn(List.of(
                new CanonicalCqlStore.MessageBucketRow(hour, older.messageBucket()),
                new CanonicalCqlStore.MessageBucketRow(hour, newer.messageBucket())));
        when(store.listMessagesByBucket(conversationId, older.messageBucket(), 2)).thenReturn(List.of(older));
        when(store.listMessagesByBucket(conversationId, newer.messageBucket(), 2)).thenReturn(List.of(newer));

        var page = service.listMessageHistory(actorId, conversationId, 1, null);

        assertThat(page.content()).containsExactly(newer);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
    }

    @Test
    void reusedClientIdWithAnotherPayloadIsRejected() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        when(store.claimMessage(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new CanonicalCqlStore.MessageClaim(
                        UUID.randomUUID(), "2026-07-22-01:03", Instant.now(), false, false));

        assertThatThrownBy(() -> service.sendMessage(actorId, conversationId, request(clientMessageId, "changed")))
                .isInstanceOf(ConflictException.class);
        verify(store, never()).insertMessage(any(), any());
    }

    @Test
    void archivedConversationRejectsNewMessagesBeforeIdempotencyClaim() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, true));

        assertThatThrownBy(() -> service.sendMessage(actorId, conversationId,
                request(UUID.randomUUID(), "blocked")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("archived conversations do not accept new messages");
        verify(store, never()).claimMessage(any(), any(), any(), any(), any(), any());
    }

    private static CanonicalApiContracts.MessageSendRequest request(UUID clientMessageId, String content) {
        return new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", content, "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of());
    }

    private static CanonicalMessage message(
            UUID conversationId, String bucket, UUID messageId, UUID senderId, UUID clientMessageId, Instant createdAt) {
        return new CanonicalMessage(
                conversationId, bucket, messageId, senderId, "TEXT", "hello", "PLAIN",
                null, null, null, null, null, null, null, null,
                false, null, null, null, false, false, false, createdAt, clientMessageId);
    }

    private static CanonicalConversation conversation(UUID conversationId) {
        return conversation(conversationId, false);
    }

    private static CanonicalConversation conversation(UUID conversationId, boolean deleted) {
        return new CanonicalConversation(
                conversationId, "GROUP", "PRIVATE_LINK", "INVITE_ONLY", "Room", "room",
                null, null, null, UUID.randomUUID(), UUID.randomUUID(), Instant.now(), Instant.now(),
                deleted, deleted ? Instant.now() : null, "OPEN", 0, null, "ALL", null, Set.of(), "vi", 100, 2, false, Instant.now());
    }
}
