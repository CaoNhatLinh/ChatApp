package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationMember;
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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
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
        lenient().when(store.listMessageInteractions(any(), any(), any(), any())).thenReturn(List.of());
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
        var interaction = new CanonicalApiContracts.MessageInteractionView(
                newer.messageId(),
                List.of(new CanonicalApiContracts.MessageReactionView("like", 2, true)),
                hour.plusSeconds(30));
        when(store.listMessageInteractions(
                conversationId, newer.messageBucket(), List.of(newer.messageId()), actorId))
                .thenReturn(List.of(interaction));

        var page = service.listMessageHistory(actorId, conversationId, 1, null);

        assertThat(page.content()).containsExactly(newer);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
        assertThat(page.interactions()).containsExactly(interaction);
        assertThat(page.polls()).isEmpty();
        verify(store).listMessageInteractions(
                conversationId, newer.messageBucket(), List.of(newer.messageId()), actorId);
    }

    @Test
    void historyHydratesOnlyPollsFromTheReturnedMessagePage() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        CanonicalMessage pollMessage = pollMessage(conversationId, pollId, actorId, createdAt);
        CanonicalPoll poll = new CanonicalPoll(
                pollId, conversationId, pollMessage.messageBucket(), pollMessage.messageId(),
                "Where next?", List.of("North", "South"), false, false, false,
                actorId, createdAt, null, null, null);
        CanonicalCqlStore.PollState state = new CanonicalCqlStore.PollState(
                Map.of(0, 3L, 1, 1L), Set.of(0), 4);
        when(store.listMessageBuckets(conversationId, null, 256)).thenReturn(List.of(
                new CanonicalCqlStore.MessageBucketRow(createdAt, pollMessage.messageBucket())));
        when(store.listMessagesByBucket(conversationId, pollMessage.messageBucket(), 2))
                .thenReturn(List.of(pollMessage));
        when(store.findPollsByIds(List.of(pollId))).thenReturn(List.of(poll));
        when(store.listPollStates(List.of(pollId), actorId)).thenReturn(Map.of(pollId, state));

        var page = service.listMessageHistory(actorId, conversationId, 1, null);

        assertThat(page.polls()).containsExactly(new CanonicalApiContracts.PollView(
                poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters()));
        verify(store).findPollsByIds(List.of(pollId));
        verify(store).listPollStates(List.of(pollId), actorId);
    }

    @Test
    void pollCreateRetryReturnsExistingPollWithoutResettingItsState() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        UUID pollId = UUID.nameUUIDFromBytes(
                (actorId + "|poll|" + clientMessageId).getBytes(StandardCharsets.UTF_8));
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        CanonicalMessage pollMessage = pollMessage(conversationId, pollId, actorId, createdAt);
        CanonicalPoll poll = new CanonicalPoll(
                pollId, conversationId, pollMessage.messageBucket(), pollMessage.messageId(),
                "Where next?", List.of("North", "South"), false, false, false,
                actorId, createdAt, null, null, null);
        CanonicalCqlStore.PollState state = new CanonicalCqlStore.PollState(Map.of(0, 2L), Set.of(0), 2);
        when(store.claimMessage(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new CanonicalCqlStore.MessageClaim(
                        pollMessage.messageId(), pollMessage.messageBucket(), createdAt, false, true));
        when(store.findMessage(conversationId, pollMessage.messageBucket(), pollMessage.messageId()))
                .thenReturn(pollMessage);
        when(store.findPollById(pollId)).thenReturn(poll);
        when(store.listPollStates(List.of(pollId), actorId)).thenReturn(Map.of(pollId, state));

        var result = service.createPoll(actorId, new CanonicalApiContracts.PollCreateRequest(
                conversationId, clientMessageId, "Where next?", List.of("North", "South"),
                false, false, null));

        assertThat(result).isEqualTo(new CanonicalApiContracts.PollView(
                poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters()));
        verify(store, never()).createPoll(any());
    }

    @Test
    void pollCreateRetryRejectsChangedOptionsForTheSameClientMessageId() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        UUID pollId = UUID.nameUUIDFromBytes(
                (actorId + "|poll|" + clientMessageId).getBytes(StandardCharsets.UTF_8));
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        CanonicalMessage pollMessage = pollMessage(conversationId, pollId, actorId, createdAt);
        CanonicalPoll poll = new CanonicalPoll(
                pollId, conversationId, pollMessage.messageBucket(), pollMessage.messageId(),
                "Where next?", List.of("North", "South"), false, false, false,
                actorId, createdAt, null, null, null);
        when(store.claimMessage(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new CanonicalCqlStore.MessageClaim(
                        pollMessage.messageId(), pollMessage.messageBucket(), createdAt, false, true));
        when(store.findMessage(conversationId, pollMessage.messageBucket(), pollMessage.messageId()))
                .thenReturn(pollMessage);
        when(store.findPollById(pollId)).thenReturn(poll);

        assertThatThrownBy(() -> service.createPoll(actorId, new CanonicalApiContracts.PollCreateRequest(
                conversationId, clientMessageId, "Where next?", List.of("North", "West"),
                false, false, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("clientMessageId is already bound to another poll payload");
        verify(store, never()).createPoll(any());
    }

    @Test
    void voteReportsClosedWhenThePollPartitionWasSealedConcurrently() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        CanonicalPoll poll = new CanonicalPoll(
                pollId, conversationId, "2026-07-22-01:03", Uuids.timeBased(),
                "Where next?", List.of("North", "South"), false, false, false,
                actorId, createdAt, null, null, null);
        when(store.findPollById(pollId)).thenReturn(poll);
        when(store.votePoll(pollId, actorId, Set.of(0))).thenReturn(CanonicalCqlStore.VoteResult.CLOSED);

        assertThatThrownBy(() -> service.votePoll(
                actorId, pollId, new CanonicalApiContracts.PollVoteRequest(Set.of(0))))
                .isInstanceOf(ConflictException.class)
                .hasMessage("poll is closed");
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
    void pinReturnsTheCanonicalUpdatedMessage() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID messageId = Uuids.timeBased();
        String bucket = "2026-07-22-01:03";
        CanonicalMessage pinned = message(
                conversationId, bucket, messageId, actorId, UUID.randomUUID(), Instant.now());
        when(store.findMessage(conversationId, bucket, messageId)).thenReturn(pinned);
        when(store.pinMessage(conversationId, bucket, messageId, actorId, true)).thenReturn(true);

        CanonicalMessage result = service.pinMessage(actorId, conversationId, bucket, messageId);

        assertThat(result).isSameAs(pinned);
        verify(store).pinMessage(conversationId, bucket, messageId, actorId, true);
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

    @Test
    void globalMentionsSettingSuppressesUnmentionedRoomMessage() {
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        when(store.claimMessage(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new CanonicalCqlStore.MessageClaim(
                        UUID.randomUUID(), "2026-07-22-01:03", createdAt, true, true));
        when(store.findUserById(actorId)).thenReturn(user(actorId));
        when(conversationRepository.findMembers(conversationId)).thenReturn(List.of(
                member(conversationId, actorId), member(conversationId, recipientId)));
        when(store.readNotificationSetting(recipientId)).thenReturn(
                new CanonicalNotificationSettings(recipientId, "MENTIONS", true, true, true, true,
                        null, null, "UTC", createdAt));

        service.sendMessage(actorId, conversationId, request(clientMessageId, "hello"));

        verify(store, never()).upsertNotification(any());
    }

    @Test
    void memberOverrideCanAllowMentionNotificationWhenRoomDefaultIsNone() {
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        when(store.claimMessage(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new CanonicalCqlStore.MessageClaim(
                        UUID.randomUUID(), "2026-07-22-01:03", createdAt, true, true));
        when(store.findConversation(conversationId)).thenReturn(conversationWithDefault(conversationId, "NONE"));
        when(store.findUserById(actorId)).thenReturn(user(actorId));
        when(conversationRepository.findMembers(conversationId)).thenReturn(List.of(
                member(conversationId, actorId), member(conversationId, recipientId, "ALL")));
        when(store.readNotificationSetting(recipientId)).thenReturn(
                new CanonicalNotificationSettings(recipientId, "ALL", true, true, true, true,
                        null, null, "UTC", createdAt));

        service.sendMessage(actorId, conversationId, new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", "hello", "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of(recipientId)));

        verify(store).upsertNotification(any());
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

    private static CanonicalMessage pollMessage(
            UUID conversationId, UUID pollId, UUID senderId, Instant createdAt) {
        return new CanonicalMessage(
                conversationId, "2026-07-22-01:03", Uuids.timeBased(), senderId, "POLL", "Where next?", "PLAIN",
                null, null, null, pollId, null, null, null, null,
                false, null, null, null, false, false, false, createdAt, UUID.randomUUID());
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

    private static CanonicalConversation conversationWithDefault(UUID conversationId, String defaultLevel) {
        return new CanonicalConversation(
                conversationId, "GROUP", "PRIVATE_LINK", "INVITE_ONLY", "Room", "room",
                null, null, null, UUID.randomUUID(), UUID.randomUUID(), Instant.now(), Instant.now(),
                false, null, "OPEN", 0, null, defaultLevel, null, Set.of(), "vi", 100, 2, false, Instant.now());
    }

    private static CanonicalUser user(UUID userId) {
        return new CanonicalUser(userId, "sender", "sender", "sender@example.com", "sender@example.com",
                "hash", "LOCAL", null, "Sender", null, "ACTIVE", Instant.now(), Instant.now(), null);
    }

    private static ConversationMember member(UUID conversationId, UUID userId) {
        return member(conversationId, userId, "INHERIT");
    }

    private static ConversationMember member(UUID conversationId, UUID userId, String notificationOverride) {
        return new ConversationMember(conversationId, userId, Set.of(), Instant.now(), null, null, null,
                notificationOverride, null, null);
    }
}
