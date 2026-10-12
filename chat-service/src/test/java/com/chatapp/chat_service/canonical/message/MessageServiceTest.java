package com.chatapp.chat_service.canonical.message;

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
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.poll.PollService;
import com.chatapp.chat_service.canonical.poll.PollRepository;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ChatPolicyService;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {
    @Mock CanonicalCqlStore store;
    @Mock CanonicalConversationRepository conversationRepository;
    @Mock ConversationAuthorizationService authorization;
    @Mock CanonicalEventRecorder eventRecorder;
    @Mock ChatPolicyService chatPolicy;
    @Mock RealtimePublisher realtime;
    @Mock NotificationService notifications;
    @Mock PollRepository pollRepository;
    @Mock MessageRepository messageRepository;
    @Mock UserRepository userRepository;
    @Mock MessageAttachmentPolicy attachmentPolicy;

    private MessageService messages;
    private PollService polls;

    @Test
    void readPositionAdvancesWithinTheSameMillisecond() {
        UUID actor = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID first = Uuids.startOf(1790992800000L);
        UUID next = new UUID(first.getMostSignificantBits() + (1L << 32), first.getLeastSignificantBits());
        String bucket = "2026-10-03-01:00";
        when(store.findConversationMember(room, actor)).thenReturn(new CanonicalConversationMember(
                room, actor, Set.of(), Instant.EPOCH, null, null, null, "INHERIT", first, Instant.EPOCH));
        when(messageRepository.find(room, bucket, next)).thenReturn(message(room, bucket, next, actor, UUID.randomUUID(), Instant.now()));
        when(messageRepository.markRead(eq(room), eq(bucket), eq(next), eq(actor), any())).thenReturn(true);
        messages.markMessageRead(actor, room, bucket, next);
        verify(messageRepository).markRead(eq(room), eq(bucket), eq(next), eq(actor), any());
        verify(realtime).publishToConversation(eq(room), eq("/read"), any());
    }

    @Test
    void rejectedAttachmentCannotReserveMessageIdentity() {
        UUID actor = UUID.randomUUID();
        org.mockito.Mockito.doThrow(new com.chatapp.chat_service.common.exception.ForbiddenException("upload denied"))
                .when(attachmentPolicy).validate(eq(actor), any());
        assertThatThrownBy(() -> messages.sendMessage(actor, UUID.randomUUID(), request(UUID.randomUUID(), "file")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ForbiddenException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @BeforeEach
    void setUp() {
        messages = new MessageService(
                store, conversationRepository, authorization, eventRecorder, chatPolicy,
                realtime, notifications, pollRepository, messageRepository, userRepository, attachmentPolicy);
        polls = new PollService(pollRepository, authorization, eventRecorder, realtime, messages);
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
        lenient().when(messageRepository.findInteractions(any(), any(), any(), any())).thenReturn(List.of());
        lenient().when(notifications.getSettings(any())).thenAnswer(invocation ->
                new CanonicalNotificationSettings(
                        invocation.getArgument(0), "ALL", true, true, true, true,
                        null, null, "UTC", Instant.now()));
    }

    @Test
    void rejectsOversizedContentBeforeClaimingMessageIdentity() {
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(),
                request(UUID.randomUUID(), "x".repeat(20_001))))
                .isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test
    void removingVotePublishesCanonicalAggregateWithoutVoterIdentity() {
        UUID actor = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        CanonicalPoll poll = new CanonicalPoll(pollId, room, "2026-10-03-01:00", Uuids.timeBased(),
                "Choose", List.of("A", "B"), false, true, false, actor, Instant.now(), null, null, null);
        when(pollRepository.findById(pollId)).thenReturn(poll);
        when(pollRepository.removeVote(pollId, actor)).thenReturn(PollRepository.VoteResult.REMOVED);
        when(pollRepository.findStates(List.of(pollId), actor)).thenReturn(Map.of(pollId,
                new PollRepository.PollState(Map.of(0, 0L, 1, 0L), Set.of(), 0)));
        var view = polls.removeVote(actor, pollId);
        verify(realtime).publishToConversation(room, "/polls",
                new CanonicalApiContracts.PollAggregateView(poll, view.optionCounts(), 0));
    }

    @Test
    void publicReadsAndDeleteRetriesNeverReturnRetainedDeletedContent() {
        UUID actor = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID id = Uuids.timeBased();
        String bucket = "2026-10-03-01:00";
        CanonicalMessage retained = new CanonicalMessage(room, bucket, id, actor, "TEXT",
                "retained content", "PLAIN", null, null, null, null, null, null, null, null,
                true, actor, Instant.now(), null, false, false, false, Instant.now(), UUID.randomUUID());
        when(messageRepository.find(room, bucket, id)).thenReturn(retained);
        when(messageRepository.findByBucket(room, bucket, 50)).thenReturn(List.of(retained));

        assertThat(messages.getMessage(actor, room, bucket, id).content()).isEmpty();
        assertThat(messages.listMessages(actor, room, bucket, 50).get(0).content()).isEmpty();
        assertThat(messages.deleteMessage(actor, room, bucket, id).content()).isEmpty();
        assertThat(messages.listMessageRevisions(actor, room, bucket, id)).isEmpty();
        verify(messageRepository, never()).findRevisions(room, bucket, id);
        assertThat(retained.content()).isEqualTo("retained content");
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
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(messageId, bucket, createdAt, false, true));
        when(messageRepository.find(conversationId, bucket, messageId)).thenReturn(existing);

        CanonicalMessage result = messages.sendMessage(actorId, conversationId, request(clientMessageId, "hello"));

        assertThat(result).isSameAs(existing);
        verify(messageRepository, never()).save(any());
        verify(messageRepository).saveBucket(existing);
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
        when(messageRepository.findBuckets(conversationId, null, 256)).thenReturn(List.of(
                new MessageRepository.MessageBucket(hour, older.messageBucket()),
                new MessageRepository.MessageBucket(hour, newer.messageBucket())));
        when(messageRepository.findByBucket(conversationId, older.messageBucket(), 2)).thenReturn(List.of(older));
        when(messageRepository.findByBucket(conversationId, newer.messageBucket(), 2)).thenReturn(List.of(newer));
        var interaction = new CanonicalApiContracts.MessageInteractionView(
                newer.messageId(),
                List.of(new CanonicalApiContracts.MessageReactionView("like", 2, true)),
                hour.plusSeconds(30));
        when(messageRepository.findInteractions(
                conversationId, newer.messageBucket(), List.of(newer.messageId()), actorId))
                .thenReturn(List.of(interaction));

        var page = messages.listMessageHistory(actorId, conversationId, 1, null);

        assertThat(page.content()).containsExactly(newer);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
        assertThat(page.interactions()).containsExactly(interaction);
        assertThat(page.polls()).isEmpty();
        verify(messageRepository).findInteractions(
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
        PollRepository.PollState state = new PollRepository.PollState(
                Map.of(0, 3L, 1, 1L), Set.of(0), 4);
        when(messageRepository.findBuckets(conversationId, null, 256)).thenReturn(List.of(
                new MessageRepository.MessageBucket(createdAt, pollMessage.messageBucket())));
        when(messageRepository.findByBucket(conversationId, pollMessage.messageBucket(), 2))
                .thenReturn(List.of(pollMessage));
        when(pollRepository.findByIds(List.of(pollId))).thenReturn(List.of(poll));
        when(pollRepository.findStates(List.of(pollId), actorId)).thenReturn(Map.of(pollId, state));

        var page = messages.listMessageHistory(actorId, conversationId, 1, null);

        assertThat(page.polls()).containsExactly(new CanonicalApiContracts.PollView(
                poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters()));
        verify(pollRepository).findByIds(List.of(pollId));
        verify(pollRepository).findStates(List.of(pollId), actorId);
    }

    @Test
    void readReceiptsReturnBoundedPageWithAuthoritativeProfiles() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID messageId = Uuids.timeBased();
        String bucket = "2026-07-22-01:03";
        UUID firstReader = UUID.randomUUID();
        UUID secondReader = UUID.randomUUID();
        UUID thirdReader = UUID.randomUUID();
        Instant firstReadAt = Instant.parse("2026-07-22T01:01:00Z");
        Instant secondReadAt = Instant.parse("2026-07-22T01:02:00Z");
        CanonicalMessage message = message(
                conversationId, bucket, messageId, actorId, UUID.randomUUID(), firstReadAt);
        when(messageRepository.find(conversationId, bucket, messageId)).thenReturn(message);
        when(messageRepository.findReadReceipts(conversationId, bucket, messageId, null, 3)).thenReturn(List.of(
                new MessageRepository.ReadReceipt(firstReader, firstReadAt),
                new MessageRepository.ReadReceipt(secondReader, secondReadAt),
                new MessageRepository.ReadReceipt(thirdReader, secondReadAt.plusSeconds(1))));
        when(userRepository.findProfilesByIds(List.of(firstReader, secondReader))).thenReturn(List.of(
                new UserRepository.UserProfile(firstReader, "first", "First Reader", null),
                new UserRepository.UserProfile(secondReader, "second", "Second Reader", null)));

        var page = messages.listMessageReadReceipts(
                actorId, conversationId, bucket, messageId, 2, null);

        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(secondReader);
        assertThat(page.content()).containsExactly(
                new CanonicalApiContracts.MessageReadReceiptView(
                        firstReader, "first", "First Reader", null, firstReadAt),
                new CanonicalApiContracts.MessageReadReceiptView(
                        secondReader, "second", "Second Reader", null, secondReadAt));
        verify(messageRepository).findReadReceipts(conversationId, bucket, messageId, null, 3);
        verify(userRepository).findProfilesByIds(List.of(firstReader, secondReader));
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
        PollRepository.PollState state = new PollRepository.PollState(Map.of(0, 2L), Set.of(0), 2);
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(
                        pollMessage.messageId(), pollMessage.messageBucket(), createdAt, false, true));
        when(messageRepository.find(conversationId, pollMessage.messageBucket(), pollMessage.messageId()))
                .thenReturn(pollMessage);
        when(pollRepository.findById(pollId)).thenReturn(poll);
        when(pollRepository.findStates(List.of(pollId), actorId)).thenReturn(Map.of(pollId, state));

        var result = polls.create(actorId, new CanonicalApiContracts.PollCreateRequest(
                conversationId, clientMessageId, "Where next?", List.of("North", "South"),
                false, false, null));

        assertThat(result).isEqualTo(new CanonicalApiContracts.PollView(
                poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters()));
        verify(pollRepository).create(poll);
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
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(
                        pollMessage.messageId(), pollMessage.messageBucket(), createdAt, false, true));
        when(messageRepository.find(conversationId, pollMessage.messageBucket(), pollMessage.messageId()))
                .thenReturn(pollMessage);
        when(pollRepository.findById(pollId)).thenReturn(poll);

        assertThatThrownBy(() -> polls.create(actorId, new CanonicalApiContracts.PollCreateRequest(
                conversationId, clientMessageId, "Where next?", List.of("North", "West"),
                false, false, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("clientMessageId is already bound to another poll payload");
        verify(pollRepository, never()).create(any());
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
        when(pollRepository.findById(pollId)).thenReturn(poll);
        when(pollRepository.vote(pollId, actorId, Set.of(0))).thenReturn(PollRepository.VoteResult.CLOSED);

        assertThatThrownBy(() -> polls.vote(
                actorId, pollId, new CanonicalApiContracts.PollVoteRequest(Set.of(0))))
                .isInstanceOf(ConflictException.class)
                .hasMessage("poll is closed");
    }

    @Test
    void reusedClientIdWithAnotherPayloadIsRejected() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(
                        UUID.randomUUID(), "2026-07-22-01:03", Instant.now(), false, false));

        assertThatThrownBy(() -> messages.sendMessage(actorId, conversationId, request(clientMessageId, "changed")))
                .isInstanceOf(ConflictException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void pinReturnsTheCanonicalUpdatedMessage() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID messageId = Uuids.timeBased();
        String bucket = "2026-07-22-01:03";
        CanonicalMessage pinned = message(
                conversationId, bucket, messageId, actorId, UUID.randomUUID(), Instant.now());
        when(messageRepository.find(conversationId, bucket, messageId)).thenReturn(pinned);
        when(messageRepository.setPinned(conversationId, bucket, messageId, actorId, true)).thenReturn(true);

        CanonicalMessage result = messages.pinMessage(actorId, conversationId, bucket, messageId);

        assertThat(result).isSameAs(pinned);
        verify(messageRepository).setPinned(conversationId, bucket, messageId, actorId, true);
        verify(eventRecorder).record(eq(actorId), eq(conversationId), eq("MESSAGE_PIN"),
                eq("message"), eq(messageId.toString()), any(), any(), any(), any(),
                argThat(payload -> payload.get("messageId").equals(messageId.toString())
                        && payload.get("messageBucket").equals(bucket)
                        && payload.containsKey("isPinned")));
    }

    @Test
    void archivedConversationRejectsNewMessagesBeforeIdempotencyClaim() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, true));

        assertThatThrownBy(() -> messages.sendMessage(actorId, conversationId,
                request(UUID.randomUUID(), "blocked")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("archived conversations do not accept new messages");
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test
    void globalMentionsSettingSuppressesUnmentionedRoomMessage() {
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(
                        UUID.randomUUID(), "2026-07-22-01:03", createdAt, true, true));
        when(userRepository.findById(actorId)).thenReturn(user(actorId));
        when(conversationRepository.findMembers(conversationId)).thenReturn(List.of(
                member(conversationId, actorId), member(conversationId, recipientId)));
        when(notifications.getSettings(recipientId)).thenReturn(
                new CanonicalNotificationSettings(recipientId, "MENTIONS", true, true, true, true,
                        null, null, "UTC", createdAt));

        messages.sendMessage(actorId, conversationId, request(clientMessageId, "hello"));

        verify(notifications, never()).publish(any());
    }

    @Test
    void memberOverrideCanAllowMentionNotificationWhenRoomDefaultIsNone() {
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(
                        UUID.randomUUID(), "2026-07-22-01:03", createdAt, true, true));
        when(store.findConversation(conversationId)).thenReturn(conversationWithDefault(conversationId, "NONE"));
        when(userRepository.findById(actorId)).thenReturn(user(actorId));
        when(conversationRepository.findMembers(conversationId)).thenReturn(List.of(
                member(conversationId, actorId), member(conversationId, recipientId, "ALL")));
        when(notifications.getSettings(recipientId)).thenReturn(
                new CanonicalNotificationSettings(recipientId, "ALL", true, true, true, true,
                        null, null, "UTC", createdAt));

        messages.sendMessage(actorId, conversationId, new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", "hello", "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of(recipientId), false));

        verify(notifications).publish(any());
    }

    @Test
    void mentionRejectsUsersOutsideConversation() {
        UUID actorId = UUID.randomUUID();
        UUID outsiderId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversationWithDefault(conversationId, "ALL"));
        when(conversationRepository.findMembers(conversationId)).thenReturn(List.of(member(conversationId, actorId)));

        assertThatThrownBy(() -> messages.sendMessage(actorId, conversationId, new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", "hello", "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of(outsiderId), false)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("mentioned users must be members of the conversation");
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test
    void mentionEveryoneExpandsToCurrentConversationMembers() {
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID clientMessageId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        when(messageRepository.claim(eq(actorId), eq(clientMessageId), eq(conversationId), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(messageId, "2026-07-22-01:03", createdAt, true, true));
        when(store.findConversation(conversationId)).thenReturn(conversationWithDefault(conversationId, "ALL"));
        when(userRepository.findById(actorId)).thenReturn(user(actorId));
        when(conversationRepository.findMembers(conversationId)).thenReturn(List.of(
                member(conversationId, actorId), member(conversationId, recipientId)));

        messages.sendMessage(actorId, conversationId, new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", "@[all|all] hello", "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of(), true));

        verify(messageRepository).saveMentions(any(), eq(Set.of(actorId, recipientId)));
    }

    private static CanonicalApiContracts.MessageSendRequest request(UUID clientMessageId, String content) {
        return new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", content, "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of(), false);
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
        return user(userId, "sender", "Sender");
    }

    private static CanonicalUser user(UUID userId, String username, String displayName) {
        return new CanonicalUser(userId, username, username, username + "@example.com", username + "@example.com",
                "hash", "LOCAL", null, displayName, null, "ACTIVE", Instant.now(), Instant.now(), null);
    }

    private static ConversationMember member(UUID conversationId, UUID userId) {
        return member(conversationId, userId, "INHERIT");
    }

    private static ConversationMember member(UUID conversationId, UUID userId, String notificationOverride) {
        return new ConversationMember(conversationId, userId, Set.of(), Instant.now(), null, null, null,
                notificationOverride, null, null);
    }
}
