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
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.isNull;
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
    @Mock com.chatapp.chat_service.canonical.sticker.StickerCatalogService stickerCatalog;

    private MessageService messages;
    private PollService polls;

    @Test void forwardUsesVerifiedSnapshotAndNeverPublishesPrivateSourceKeys() {
        UUID actor = UUID.randomUUID(), target = UUID.randomUUID(), client = UUID.randomUUID(), sourceRoom = UUID.randomUUID();
        prepareNotificationRecipient(actor, target, client);
        var source = message(sourceRoom, "2026-10-20-08:03", Uuids.timeBased(), UUID.randomUUID(), UUID.randomUUID(), Instant.now());
        when(messageRepository.find(sourceRoom, source.messageBucket(), source.messageId())).thenReturn(source);
        var request = forwardRequest(client, source);
        var saved = messages.sendMessage(actor, target, request);
        assertThat(saved.content()).isEqualTo(source.content());
        assertThat(saved.forwardedFromMessageId()).isEqualTo(source.messageId());
        assertThat(saved.senderId()).isEqualTo(actor);
        verify(attachmentPolicy).validateForwarded(request.attachments());
        verify(realtime).publishToConversation(eq(target), eq(""), argThat(payload -> payload instanceof Map<?, ?> map
                && Boolean.TRUE.equals(map.get("forwarded")) && !map.containsKey("forwardedFromConversationId")
                && !map.containsKey("forwardedFromMessageBucket") && !map.containsKey("forwardedFromMessageId")));
    }

    @Test void missingForwardSourceCannotAllocateOrSave() {
        var source = message(UUID.randomUUID(), "2026-10-20-08:03", Uuids.timeBased(), UUID.randomUUID(), UUID.randomUUID(), Instant.now());
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(), forwardRequest(UUID.randomUUID(), source)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.NotFoundException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void committedForwardRetryRepairsIndexAndAttachmentsWithoutMutableSourceLookup() {
        UUID actor = UUID.randomUUID(), target = UUID.randomUUID(), client = UUID.randomUUID(), sourceRoom = UUID.randomUUID(), sourceId = Uuids.timeBased();
        var attachment = new CanonicalApiContracts.AttachmentRequest(UUID.randomUUID(), UUID.randomUUID(), "CLOUDINARY",
                "key", "image.png", "image/png", 10L, null, null, null, null, false);
        var request = new CanonicalApiContracts.MessageSendRequest(client, "TEXT", "hello", "PLAIN", null, null, null, null,
                sourceRoom, "2026-10-20-08:03", sourceId, List.of(attachment), Set.of(), false, null);
        var saved = new CanonicalMessage(target, "2026-10-20-09:02", Uuids.timeBased(), actor, "TEXT", "hello", "PLAIN",
                null, null, null, null, null, sourceRoom, request.forwardedFromMessageBucket(), sourceId, false, null,
                null, null, true, false, false, Instant.now(), client, null, null, 0);
        when(messageRepository.findClaim(actor, client, target, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(saved.messageId(), saved.messageBucket(), saved.createdAt(), false, true));
        when(messageRepository.find(target, saved.messageBucket(), saved.messageId())).thenReturn(saved);
        assertThat(messages.sendMessage(actor, target, request)).isSameAs(saved);
        verify(messageRepository).repairSourceProjections(saved);
        verify(messageRepository).saveAttachment(saved, attachment);
        verify(messageRepository, never()).find(sourceRoom, request.forwardedFromMessageBucket(), sourceId);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void forwardedContentCannotBeEditedToMisattributeNewText() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
        var saved = new CanonicalMessage(room, "2026-10-20-08:03", id, actor, "TEXT", "original", "PLAIN",
                null, null, null, null, null, UUID.randomUUID(), "2026-10-19-08:03", Uuids.timeBased(), false,
                null, null, null, false, false, false, Instant.now(), UUID.randomUUID(), null, null, 0);
        when(messageRepository.find(room, saved.messageBucket(), id)).thenReturn(saved);
        assertThatThrownBy(() -> messages.editMessage(actor, room, saved.messageBucket(), id,
                new CanonicalApiContracts.MessageUpdateRequest("invented"))).isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).updateContent(any(), any(), any(), any(), any());
    }

    @Test void committedOrdinaryMediaRetryRepairsEveryFrozenAttachmentWithoutAllocatingAgain() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        var request = mediaRequest(client);
        var saved = mediaMessage(actor, room, request, false);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(saved.messageId(), saved.messageBucket(), saved.createdAt(), false, true));
        when(messageRepository.find(room, saved.messageBucket(), saved.messageId())).thenReturn(saved);
        assertThat(messages.sendMessage(actor, room, request)).isSameAs(saved);
        for (var attachment : request.attachments()) verify(messageRepository).saveAttachment(saved, attachment);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
        verify(attachmentPolicy, never()).validate(any(), any());
        org.mockito.Mockito.verifyNoInteractions(realtime, eventRecorder, notifications);
    }

    @Test void interruptedOrdinaryAttachmentRepairFailsThenConvergesWithTheSameKeys() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        var request = mediaRequest(client);
        var saved = mediaMessage(actor, room, request, false);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(saved.messageId(), saved.messageBucket(), saved.createdAt(), false, true));
        when(messageRepository.find(room, saved.messageBucket(), saved.messageId())).thenReturn(saved);
        var stored = new java.util.LinkedHashMap<UUID, CanonicalApiContracts.AttachmentRequest>();
        var failSecondOnce = new java.util.concurrent.atomic.AtomicBoolean(true);
        org.mockito.Mockito.doAnswer(invocation -> {
            CanonicalApiContracts.AttachmentRequest attachment = invocation.getArgument(1);
            if (attachment.equals(request.attachments().get(1)) && failSecondOnce.getAndSet(false))
                throw new IllegalStateException("controlled interruption between attachment writes");
            stored.put(attachment.attachmentId(), attachment);
            return null;
        }).when(messageRepository).saveAttachment(eq(saved), any());
        assertThatThrownBy(() -> messages.sendMessage(actor, room, request)).isInstanceOf(IllegalStateException.class);
        assertThat(stored.values()).containsExactly(request.attachments().get(0));
        assertThat(messages.sendMessage(actor, room, request)).isSameAs(saved);
        assertThat(stored.values()).containsExactlyElementsOf(request.attachments());
        for (var attachment : request.attachments()) org.mockito.Mockito.verify(messageRepository, org.mockito.Mockito.times(2)).saveAttachment(saved, attachment);
        verify(messageRepository, never()).createIfAbsent(any());
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test void deletedMediaRetryDoesNotRecreateReferencesOrSourceIndexes() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        var request = mediaRequest(client);
        var deleted = mediaMessage(actor, room, request, true);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(deleted.messageId(), deleted.messageBucket(), deleted.createdAt(), false, true));
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenReturn(deleted);
        var result = messages.sendMessage(actor, room, request);
        assertThat(result.isDeleted()).isTrue(); assertThat(result.hasAttachments()).isFalse();
        verify(messageRepository, never()).saveAttachment(any(), any());
        verify(messageRepository, never()).repairSourceProjections(any());
        org.mockito.Mockito.verifyNoInteractions(realtime, eventRecorder, notifications);
    }

    @Test void fingerprintConflictCannotRepairOrdinaryAttachmentReferences() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        var request = mediaRequest(client);
        var saved = mediaMessage(actor, room, request, false);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(saved.messageId(), saved.messageBucket(), saved.createdAt(), false, false));
        assertThatThrownBy(() -> messages.sendMessage(actor, room, request)).isInstanceOf(ConflictException.class);
        verify(messageRepository, never()).saveAttachment(any(), any());
        verify(messageRepository, never()).saveBucket(any());
        verify(messageRepository, never()).find(any(), any(), any());
    }

    @Test void initialSendInterruptedAfterMessageCommitRepairsOnTheNextIdenticalRequest() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        var request = mediaRequest(client);
        var at = Instant.now(); String bucket = "2026-10-23-08:00";
        var committed = new java.util.concurrent.atomic.AtomicReference<CanonicalMessage>();
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenAnswer(invocation -> committed.get() == null ? null : new MessageRepository.MessageClaim(id, bucket, at, false, true));
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), eq(MessageRequestFingerprint.sha256(request)), any()))
                .thenReturn(new MessageRepository.MessageClaim(id, bucket, at, true, true));
        when(messageRepository.find(room, bucket, id)).thenAnswer(invocation -> committed.get());
        org.mockito.Mockito.doAnswer(invocation -> { committed.set(invocation.getArgument(0)); return true; })
                .when(messageRepository).createIfAbsent(any());
        var stored = new java.util.LinkedHashMap<UUID, CanonicalApiContracts.AttachmentRequest>();
        var failOnce = new java.util.concurrent.atomic.AtomicBoolean(true);
        org.mockito.Mockito.doAnswer(invocation -> {
            CanonicalApiContracts.AttachmentRequest attachment = invocation.getArgument(1);
            if (attachment.equals(request.attachments().get(1)) && failOnce.getAndSet(false))
                throw new IllegalStateException("controlled initial attachment failure");
            stored.put(attachment.attachmentId(), attachment); return null;
        }).when(messageRepository).saveAttachment(any(), any());
        assertThatThrownBy(() -> messages.sendMessage(actor, room, request)).isInstanceOf(IllegalStateException.class);
        assertThat(committed.get()).isNotNull();
        assertThat(stored.values()).containsExactly(request.attachments().get(0));
        var result = messages.sendMessage(actor, room, request);
        assertThat(result.messageId()).isEqualTo(id); assertThat(result.messageBucket()).isEqualTo(bucket);
        assertThat(result.createdAt()).isEqualTo(at);
        assertThat(stored.values()).containsExactlyElementsOf(request.attachments());
        verify(messageRepository).createIfAbsent(committed.get());
        verify(messageRepository).claim(eq(actor), eq(client), eq(room), any(), any(), any());
        verify(attachmentPolicy).validate(actor, request.attachments());
        var order = org.mockito.Mockito.inOrder(attachmentPolicy, messageRepository);
        order.verify(attachmentPolicy).retainForHistory(request.attachments());
        order.verify(messageRepository).createIfAbsent(committed.get());
        org.mockito.Mockito.verifyNoInteractions(realtime, eventRecorder, notifications);
    }

    @Test
    void deletionWinningAttachmentFencePreventsMessageCreation() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        var request = mediaRequest(client);
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(Uuids.timeBased(), "2026-10-23-08:00", Instant.now(), true, true));
        org.mockito.Mockito.doThrow(new com.chatapp.chat_service.common.exception.ConflictException("deletion already claimed"))
                .when(attachmentPolicy).retainForHistory(request.attachments());

        assertThatThrownBy(() -> messages.sendMessage(actor, room, request))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);
        verify(messageRepository, never()).createIfAbsent(any());
        org.mockito.Mockito.verifyNoInteractions(realtime, eventRecorder, notifications);
    }

    @Test void retryAfterInterruptedMentionWriteRepairsOnlyTheFrozenMessageReferences() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        UUID mentioned = UUID.randomUUID(), messageId = Uuids.timeBased();
        Instant createdAt = Instant.now();
        String bucket = "2026-10-23-08:00";
        var request = new CanonicalApiContracts.MessageSendRequest(client, "TEXT", "hello", "PLAIN", null, null,
                null, null, null, null, null, List.of(), Set.of(mentioned), false, null);
        var committed = new CanonicalMessage(room, bucket, messageId, actor, "TEXT", "hello", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null,
                false, true, false, createdAt, client, null, null, 0);
        String fingerprint = MessageRequestFingerprint.sha256(request);
        when(messageRepository.findClaim(actor, client, room, fingerprint)).thenReturn(null,
                new MessageRepository.MessageClaim(messageId, bucket, createdAt, false, true));
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), eq(fingerprint), any()))
                .thenReturn(new MessageRepository.MessageClaim(messageId, bucket, createdAt, true, true));
        when(messageRepository.find(room, bucket, messageId)).thenReturn(committed);
        when(conversationRepository.findMembers(room)).thenReturn(List.of(member(room, actor), member(room, mentioned)));
        org.mockito.Mockito.doThrow(new IllegalStateException("interrupted mention batch"))
                .when(messageRepository).saveMentions(committed, Set.of(mentioned));

        assertThatThrownBy(() -> messages.sendMessage(actor, room, request))
                .isInstanceOf(IllegalStateException.class).hasMessage("interrupted mention batch");
        assertThat(messages.sendMessage(actor, room, request)).isSameAs(committed);

        verify(conversationRepository).findMembers(room);
        verify(messageRepository).createIfAbsent(committed);
        verify(messageRepository).saveMentions(committed, Set.of(mentioned));
        verify(messageRepository).repairMentionReferences(committed, Set.of(mentioned));
        org.mockito.Mockito.verifyNoInteractions(realtime, eventRecorder, notifications);
    }

    private static CanonicalApiContracts.MessageSendRequest mediaRequest(UUID client) {
        var attachments = java.util.stream.IntStream.range(0, 2).mapToObj(index -> new CanonicalApiContracts.AttachmentRequest(
                UUID.randomUUID(), UUID.randomUUID(), "CLOUDINARY", "key/" + index, "photo-" + index + ".png",
                "image/png", 64L, 100, 80, null, "https://cdn.example/" + index + ".png", false)).toList();
        return new CanonicalApiContracts.MessageSendRequest(client, "IMAGE", "photos", "PLAIN_TEXT", null, null,
                null, null, null, null, null, attachments, Set.of(), false, null);
    }

    private static CanonicalMessage mediaMessage(UUID actor, UUID room, CanonicalApiContracts.MessageSendRequest request, boolean deleted) {
        return new CanonicalMessage(room, "2026-10-23-08:00", Uuids.timeBased(), actor, "IMAGE", "photos", "PLAIN_TEXT",
                null, null, null, null, null, null, null, null, deleted, deleted ? actor : null,
                deleted ? Instant.now() : null, null, true, false, false, Instant.now(), request.clientMessageId(), null, null, 0);
    }

    private static CanonicalApiContracts.MessageSendRequest forwardRequest(UUID client, CanonicalMessage source) {
        return new CanonicalApiContracts.MessageSendRequest(client, source.messageType(), source.content(), source.contentFormat(),
                null, null, source.stickerId(), null, source.conversationId(), source.messageBucket(), source.messageId(),
                List.of(), Set.of(), false, source.gif());
    }

    @Test void replyPersistsServerResolvedSenderAndFullParentKeyInRealtime() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), parentId = Uuids.timeBased();
        prepareNotificationRecipient(actor, room, client);
        var parent = message(room, "2026-10-20-08:03", parentId, UUID.randomUUID(), UUID.randomUUID(), Instant.now());
        when(messageRepository.find(room, parent.messageBucket(), parentId)).thenReturn(parent);
        var request = replyRequest(client, parentId, parent.messageBucket());
        var saved = messages.sendMessage(actor, room, request);
        assertThat(saved.replyToSenderId()).isEqualTo(parent.senderId());
        assertThat(saved.replyToMessageBucket()).isEqualTo(parent.messageBucket());
        verify(messageRepository).createIfAbsent(saved);
        verify(realtime).publishToConversation(eq(room), eq(""), argThat(payload -> payload instanceof Map<?, ?> map
                && parent.messageBucket().equals(map.get("replyToMessageBucket"))
                && parent.senderId().toString().equals(map.get("replyToSenderId"))));
    }

    @Test void missingReplyDoesNotAllocateIdentity() {
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(),
                replyRequest(UUID.randomUUID(), Uuids.timeBased(), "2026-10-20-08:03")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.NotFoundException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test void committedReplyRepairsIndexWithoutRevalidatingMutableParent() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), parentId = Uuids.timeBased();
        var request = replyRequest(client, parentId, "2026-10-20-08:03");
        var child = new CanonicalMessage(room, "2026-10-20-09:01", Uuids.timeBased(), actor, "TEXT", "reply", "PLAIN",
                parentId, UUID.randomUUID(), null, null, null, null, null, null, false, null, null, null,
                false, false, false, Instant.now(), client, null, request.replyToMessageBucket(), 0);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(child.messageId(), child.messageBucket(), child.createdAt(), false, true));
        when(messageRepository.find(room, child.messageBucket(), child.messageId())).thenReturn(child);
        assertThat(messages.sendMessage(actor, room, request)).isSameAs(child);
        verify(messageRepository, never()).find(room, request.replyToMessageBucket(), parentId);
        verify(messageRepository).repairSourceProjections(child);
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void changingParentBucketChangesFingerprintAndConflictPrecedesSourceLookup() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), parent = Uuids.timeBased();
        var original = replyRequest(client, parent, "2026-10-20-08:03");
        var changed = replyRequest(client, parent, "2026-10-20-08:04");
        assertThat(MessageRequestFingerprint.sha256(changed)).isNotEqualTo(MessageRequestFingerprint.sha256(original));
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(changed)))
                .thenReturn(new MessageRepository.MessageClaim(Uuids.timeBased(), "2026-10-20-09:00", Instant.now(), false, false));
        assertThatThrownBy(() -> messages.sendMessage(actor, room, changed)).isInstanceOf(ConflictException.class);
        verify(messageRepository, never()).find(any(), any(), any());
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    private static CanonicalApiContracts.MessageSendRequest replyRequest(UUID client, UUID parent, String bucket) {
        return new CanonicalApiContracts.MessageSendRequest(client, "TEXT", "reply", "PLAIN", parent, bucket,
                null, null, null, null, null, List.of(), Set.of(), false, null);
    }

    @Test
    void readPositionAdvancesWithinTheSameMillisecond() {
        UUID actor = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID first = Uuids.startOf(1790992800000L);
        UUID next = new UUID(first.getMostSignificantBits() + (1L << 32), first.getLeastSignificantBits());
        String bucket = "2026-10-03-01:00";
        when(store.findConversationMember(room, actor)).thenReturn(new CanonicalConversationMember(
                room, actor, Set.of(), Instant.EPOCH, null, null, null, "INHERIT", first, Instant.EPOCH));
        when(messageRepository.find(room, bucket, next)).thenReturn(message(room, bucket, next, UUID.randomUUID(), UUID.randomUUID(), Instant.now()));
        when(messageRepository.markRead(eq(room), eq(bucket), eq(next), eq(actor), eq(Instant.EPOCH), any())).thenReturn(true);
        messages.markMessageRead(actor, room, bucket, next);
        verify(messageRepository).markRead(eq(room), eq(bucket), eq(next), eq(actor), eq(Instant.EPOCH), any());
        verify(store).clearReadConversationProjection(actor, room, next, Instant.EPOCH);
        verify(realtime).publishToConversation(eq(room), eq("/read"), any());
    }

    @Test
    void readingYourOwnLatestMessageAdvancesPointerWithoutFakingASeenReceipt() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
        String bucket = "2026-10-20-08:00";
        when(store.findConversationMember(room, actor)).thenReturn(new CanonicalConversationMember(
                room, actor, Set.of(), Instant.EPOCH, null, null, null, "INHERIT", null, null));
        when(messageRepository.find(room, bucket, id)).thenReturn(message(room, bucket, id, actor, UUID.randomUUID(), Instant.now()));
        when(messageRepository.advanceReadPosition(eq(room), eq(actor), eq(id), eq(Instant.EPOCH), any())).thenReturn(true);
        messages.markMessageRead(actor, room, bucket, id);
        verify(store).clearReadConversationProjection(actor, room, id, Instant.EPOCH);
        verify(messageRepository, never()).markRead(any(), any(), any(), any(), any(), any());
        verify(realtime, never()).publishToConversation(eq(room), eq("/read"), any());
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
        lenient().when(messageRepository.createIfAbsent(any())).thenReturn(true);
        messages = new MessageService(
                store, conversationRepository, authorization, eventRecorder, chatPolicy,
                realtime, notifications, pollRepository, messageRepository, userRepository, attachmentPolicy, new MessageStickerPolicy(stickerCatalog),
                new MessageReplyPolicy(messageRepository, org.mockito.Mockito.mock(com.chatapp.chat_service.canonical.social.FriendshipRepository.class)),
                new MessageForwardPolicy(messageRepository, authorization, org.mockito.Mockito.mock(com.chatapp.chat_service.canonical.social.FriendshipRepository.class)));
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
                true, actor, Instant.now(), null, false, false, false, Instant.now(), UUID.randomUUID(), null, null, 0);
        when(messageRepository.find(room, bucket, id)).thenReturn(retained);
        when(messageRepository.findByBucket(room, bucket, 50)).thenReturn(List.of(retained));
        when(messageRepository.findPinState(room)).thenReturn(new MessageRepository.PinState(0, List.of()));

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
        verify(messageRepository, never()).createIfAbsent(any());
        verify(messageRepository).saveBucket(existing);
        verify(store).repairCanonicalConversationPreview(eq(existing), isNull());
        verify(store, never()).updateLastMessageProjections(any(), any(), any());
        verify(eventRecorder, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void unavailableStickerCannotAllocateMessageIdentity() {
        UUID stickerId = UUID.randomUUID();
        org.mockito.Mockito.doThrow(new com.chatapp.chat_service.common.exception.NotFoundException("unavailable"))
                .when(stickerCatalog).requireSendable(stickerId);
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(), stickerRequest(UUID.randomUUID(), stickerId)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.NotFoundException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void publishedStickerIsStoredAndPublishedUsingCanonicalMessageIdentity() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), stickerId = UUID.randomUUID();
        UUID messageId = Uuids.timeBased();
        Instant createdAt = Instant.now();
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any())).thenReturn(
                new MessageRepository.MessageClaim(messageId, "2026-10-12-01:00", createdAt, true, true));
        when(userRepository.findById(actor)).thenReturn(user(actor));
        var saved = messages.sendMessage(actor, room, stickerRequest(client, stickerId));
        assertThat(saved.stickerId()).isEqualTo(stickerId);
        assertThat(saved.messageId()).isEqualTo(messageId);
        assertThat(saved.clientMessageId()).isEqualTo(client);
        assertThat(saved.content()).isEmpty();
        verify(stickerCatalog).requireSendable(stickerId);
        verify(messageRepository).createIfAbsent(saved);
        verify(realtime).publishToConversation(eq(room), eq(""), argThat(payload -> payload instanceof Map<?, ?> map
                && stickerId.toString().equals(map.get("stickerId")) && "STICKER".equals(map.get("messageType"))));
    }

    @Test void committedStickerRetryDoesNotRevalidateRemovedCatalogOrWriteAgain() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), stickerId = UUID.randomUUID();
        var request = stickerRequest(client, stickerId);
        var committed = new CanonicalMessage(room, "2026-10-12-01:00", Uuids.timeBased(), actor, "STICKER", "", "PLAIN",
                null, null, stickerId, null, null, null, null, null, false, null, null, null, false, false, false, Instant.now(), client, null, null, 0);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(committed.messageId(), committed.messageBucket(), committed.createdAt(), false, true));
        when(messageRepository.find(room, committed.messageBucket(), committed.messageId())).thenReturn(committed);
        assertThat(messages.sendMessage(actor, room, request)).isSameAs(committed);
        org.mockito.Mockito.verifyNoInteractions(stickerCatalog);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void stickerNotificationHasAReadablePreviewAndStructuredMessageType() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        prepareNotificationRecipient(actor, room, client);
        messages.sendMessage(actor, room, stickerRequest(client, UUID.randomUUID()));
        verify(notifications).publish(argThat(notification ->
                "Sticker".equals(notification.bodyPreview())
                        && "STICKER".equals(notification.actionPayload().get("messageType"))
                        && room.toString().equals(notification.actionPayload().get("conversationId"))));
    }

    @Test void textNotificationRetainsUserAuthoredContentEvenWhenItSaysSticker() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        prepareNotificationRecipient(actor, room, client);
        messages.sendMessage(actor, room, request(client, "Sticker"));
        verify(notifications).publish(argThat(notification ->
                "Sticker".equals(notification.bodyPreview())
                        && "TEXT".equals(notification.actionPayload().get("messageType"))));
    }

    private void prepareNotificationRecipient(UUID actor, UUID room, UUID client) {
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any()))
                .thenReturn(new MessageRepository.MessageClaim(Uuids.timeBased(), "2026-10-20-08:00", Instant.now(), true, true));
        when(userRepository.findById(actor)).thenReturn(user(actor));
        when(conversationRepository.findMembers(room)).thenReturn(List.of(member(room, actor), member(room, UUID.randomUUID())));
    }

    @Test void stickerCannotBeChangedIntoClientSuppliedContentThroughEdit() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), messageId = Uuids.timeBased();
        String bucket = "2026-10-12-01:00";
        when(messageRepository.find(room, bucket, messageId)).thenReturn(new CanonicalMessage(room, bucket, messageId,
                actor, "STICKER", "", "PLAIN", null, null, UUID.randomUUID(), null, null, null, null, null,
                false, null, null, null, false, false, false, Instant.now(), UUID.randomUUID(), null, null, 0));
        assertThatThrownBy(() -> messages.editMessage(actor, room, bucket, messageId,
                new CanonicalApiContracts.MessageUpdateRequest("https://untrusted.example/art.png")))
                .isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).updateContent(any(), any(), any(), any(), any());
    }

    @Test void changedStickerCannotReusePreviousMessageClaim() {
        when(messageRepository.findClaim(any(), any(), any(), any())).thenReturn(new MessageRepository.MessageClaim(
                UUID.randomUUID(), "2026-10-12-01:00", Instant.now(), false, false));
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(), stickerRequest(UUID.randomUUID(), UUID.randomUUID())))
                .isInstanceOf(ConflictException.class);
        org.mockito.Mockito.verifyNoInteractions(stickerCatalog);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test void reservedButUncommittedStickerMustStillBeAvailable() {
        UUID stickerId = UUID.randomUUID();
        when(messageRepository.findClaim(any(), any(), any(), any())).thenReturn(new MessageRepository.MessageClaim(
                UUID.randomUUID(), "2026-10-12-01:00", Instant.now(), false, true));
        org.mockito.Mockito.doThrow(new com.chatapp.chat_service.common.exception.NotFoundException("unavailable"))
                .when(stickerCatalog).requireSendable(stickerId);
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(), stickerRequest(UUID.randomUUID(), stickerId)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.NotFoundException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void stickerSendChecksRoomPermissionBeforeLookingAtCatalogOrClaim() {
        org.mockito.Mockito.doThrow(new com.chatapp.chat_service.common.exception.ForbiddenException("denied"))
                .when(authorization).requirePermission(any(), any(), eq(ConversationPermission.MESSAGE_SEND));
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(), stickerRequest(UUID.randomUUID(), UUID.randomUUID())))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ForbiddenException.class);
        org.mockito.Mockito.verifyNoInteractions(stickerCatalog, messageRepository);
    }

    private static CanonicalApiContracts.MessageSendRequest stickerRequest(UUID client, UUID stickerId) {
        return new CanonicalApiContracts.MessageSendRequest(client, "STICKER", "", "PLAIN", null, null,
                stickerId, null, null, null, null, List.of(), Set.of(), false, null);
    }

    private static CanonicalApiContracts.MessageSendRequest gifRequest(UUID client, String providerId) {
        return new CanonicalApiContracts.MessageSendRequest(client, "GIF", "", "PLAIN", null, null,
                null, null, null, null, null, List.of(), Set.of(), false,
                new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.GifReference("GIPHY", providerId));
    }

    @Test void gifIdentityIsStoredAndPublishedWithoutProviderUrlsAndHasReadableNotification() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        prepareNotificationRecipient(actor, room, client);
        var request = gifRequest(client, "abc123");
        var saved = messages.sendMessage(actor, room, request);
        assertThat(saved.gif()).isEqualTo(request.gif());
        assertThat(saved.content()).isEmpty();
        verify(messageRepository).createIfAbsent(saved);
        verify(realtime).publishToConversation(eq(room), eq(""), argThat(payload -> payload instanceof Map<?, ?> map
                && request.gif().equals(map.get("gif")) && "GIF".equals(map.get("messageType"))));
        verify(notifications).publish(argThat(notification -> "GIF".equals(notification.bodyPreview())
                && "GIF".equals(notification.actionPayload().get("messageType"))));
        org.mockito.Mockito.verifyNoInteractions(stickerCatalog);
    }

    @Test void committedGifRetryReturnsOriginalIdentityWithoutAnotherWriteOrProviderLookup() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID();
        var request = gifRequest(client, "abc123");
        var committed = new CanonicalMessage(room, "2026-10-20-08:00", Uuids.timeBased(), actor, "GIF", "", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null, false, false, false,
                Instant.now(), client, request.gif(), null, 0);
        when(messageRepository.findClaim(actor, client, room, MessageRequestFingerprint.sha256(request)))
                .thenReturn(new MessageRepository.MessageClaim(committed.messageId(), committed.messageBucket(), committed.createdAt(), false, true));
        when(messageRepository.find(room, committed.messageBucket(), committed.messageId())).thenReturn(committed);
        assertThat(messages.sendMessage(actor, room, request)).isSameAs(committed);
        verify(messageRepository, never()).createIfAbsent(any());
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        org.mockito.Mockito.verifyNoInteractions(stickerCatalog);
    }

    @Test void invalidGifCannotReserveAnIdentityAndChangedGifCannotReuseAClaim() {
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(),
                gifRequest(UUID.randomUUID(), "https://evil.test/image.gif"))).isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).findClaim(any(), any(), any(), any());
        when(messageRepository.findClaim(any(), any(), any(), any())).thenReturn(new MessageRepository.MessageClaim(
                Uuids.timeBased(), "2026-10-20-08:00", Instant.now(), false, false));
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(),
                gifRequest(UUID.randomUUID(), "different"))).isInstanceOf(ConflictException.class);
        verify(messageRepository, never()).claim(any(), any(), any(), any(), any(), any());
        verify(messageRepository, never()).createIfAbsent(any());
    }

    @Test void gifSendRequiresRoomPermissionBeforeAnyClaim() {
        org.mockito.Mockito.doThrow(new com.chatapp.chat_service.common.exception.ForbiddenException("denied"))
                .when(authorization).requirePermission(any(), any(), eq(ConversationPermission.MESSAGE_SEND));
        assertThatThrownBy(() -> messages.sendMessage(UUID.randomUUID(), UUID.randomUUID(), gifRequest(UUID.randomUUID(), "abc")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ForbiddenException.class);
        org.mockito.Mockito.verifyNoInteractions(messageRepository);
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
        when(messageRepository.findPinState(conversationId)).thenReturn(new MessageRepository.PinState(7,
                List.of(new MessageRepository.PinSlot((byte) 0, newer.messageBucket(), newer.messageId(), Uuids.timeBased()))));
        when(messageRepository.findBuckets(conversationId, null, 257)).thenReturn(List.of(
                new MessageRepository.MessageBucket(hour, older.messageBucket()),
                new MessageRepository.MessageBucket(hour, newer.messageBucket()),
                new MessageRepository.MessageBucket(hour.minusSeconds(3600), "2026-07-22-00:00")));
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

        assertThat(page.content()).containsExactly(PublicMessageView.withPinned(newer, true));
        verify(messageRepository).findPinState(conversationId);
        verify(messageRepository, never()).findByBucket(conversationId, "2026-07-22-00:00", 2);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
        assertThat(page.interactions()).containsExactly(interaction);
        assertThat(page.polls()).isEmpty();
        verify(messageRepository).findInteractions(
                conversationId, newer.messageBucket(), List.of(newer.messageId()), actorId);

        when(messageRepository.findBuckets(conversationId, hour, 257)).thenReturn(List.of(
                new MessageRepository.MessageBucket(hour, older.messageBucket()),
                new MessageRepository.MessageBucket(hour, newer.messageBucket())));
        when(messageRepository.findByBucketBefore(conversationId, older.messageBucket(), newer.messageId(), 2))
                .thenReturn(List.of(older));

        var resumed = messages.listMessageHistory(actorId, conversationId, 1, page.nextCursor());

        assertThat(resumed.content()).containsExactly(older);
        assertThat(resumed.hasNext()).isFalse();
        verify(messageRepository).findByBucketBefore(conversationId, newer.messageBucket(), newer.messageId(), 2);
    }

    @Test
    void historyDoesNotSplitAnHourAtTheBucketScanLimit() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant hour = Instant.parse("2026-07-22T01:00:00Z");
        var buckets = new ArrayList<>(IntStream.range(0, 255)
                .mapToObj(i -> new MessageRepository.MessageBucket(hour.plusSeconds((255L - i) * 3600), "newer-" + i))
                .toList());
        var firstShard = new MessageRepository.MessageBucket(hour, "2026-07-22-01:00");
        var secondShard = new MessageRepository.MessageBucket(hour, "2026-07-22-01:01");
        buckets.add(firstShard);
        buckets.add(secondShard);
        when(messageRepository.findBuckets(conversationId, null, 257)).thenReturn(buckets);
        Instant latestHour = buckets.get(0).bucketHour();
        CanonicalMessage latest = message(conversationId, buckets.get(0).value(), Uuids.timeBased(), actorId,
                UUID.randomUUID(), latestHour);
        CanonicalMessage older = message(conversationId, firstShard.value(), Uuids.timeBased(), actorId,
                UUID.randomUUID(), hour.plusSeconds(10));
        CanonicalMessage newer = message(conversationId, secondShard.value(), Uuids.timeBased(), actorId,
                UUID.randomUUID(), hour.plusSeconds(20));
        when(messageRepository.findPinState(conversationId)).thenReturn(new MessageRepository.PinState(0, List.of()));
        when(messageRepository.findByBucket(conversationId, latest.messageBucket(), 3)).thenReturn(List.of(latest));

        var first = messages.listMessageHistory(actorId, conversationId, 2, null);

        assertThat(first.content()).containsExactly(latest);
        assertThat(first.hasNext()).isTrue();
        verify(messageRepository, never()).findByBucket(conversationId, firstShard.value(), 3);
        verify(messageRepository, never()).findByBucket(conversationId, secondShard.value(), 3);
        when(messageRepository.findBuckets(conversationId, hour, 257)).thenReturn(List.of(firstShard, secondShard));
        when(messageRepository.findByBucket(conversationId, firstShard.value(), 3)).thenReturn(List.of(older));
        when(messageRepository.findByBucket(conversationId, secondShard.value(), 3)).thenReturn(List.of(newer));

        var resumed = messages.listMessageHistory(actorId, conversationId, 2, first.nextCursor());

        assertThat(resumed.content()).containsExactly(newer, older);
        assertThat(resumed.hasNext()).isFalse();
        assertThat(resumed.nextCursor()).isNull();
    }

    @Test
    void historyCanContinueAfterScanningOnlyEmptyBuckets() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant hour = Instant.parse("2026-07-22T01:00:00Z");
        var buckets = IntStream.rangeClosed(0, 256)
                .mapToObj(i -> new MessageRepository.MessageBucket(hour.plusSeconds((256L - i) * 3600), "bucket-" + i))
                .toList();
        when(messageRepository.findBuckets(conversationId, null, 257)).thenReturn(buckets);

        var first = messages.listMessageHistory(actorId, conversationId, 2, null);

        assertThat(first.content()).isEmpty();
        assertThat(first.hasNext()).isTrue();
        assertThat(first.nextCursor()).isNotBlank();
        when(messageRepository.findBuckets(conversationId, hour, 257)).thenReturn(List.of(buckets.get(256)));

        var resumed = messages.listMessageHistory(actorId, conversationId, 2, first.nextCursor());

        assertThat(resumed.content()).isEmpty();
        assertThat(resumed.hasNext()).isFalse();
        assertThat(resumed.nextCursor()).isNull();
        verify(messageRepository).findByBucket(conversationId, "bucket-256", 3);
    }

    @Test
    void historyRejectsInvalidHourOrNonTimeUuidCursor() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        for (String value : List.of("h|1", "0|" + UUID.randomUUID())) {
            String cursor = Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
            assertThatThrownBy(() -> messages.listMessageHistory(actorId, conversationId, 2, cursor))
                    .isInstanceOf(BadRequestException.class);
        }
        verify(messageRepository, never()).findBuckets(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void historyHydratesOnlyPollsFromTheReturnedMessagePage() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(messageRepository.findPinState(conversationId)).thenReturn(new MessageRepository.PinState(0, List.of()));
        UUID pollId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-22T01:00:00Z");
        CanonicalMessage pollMessage = pollMessage(conversationId, pollId, actorId, createdAt);
        CanonicalPoll poll = new CanonicalPoll(
                pollId, conversationId, pollMessage.messageBucket(), pollMessage.messageId(),
                "Where next?", List.of("North", "South"), false, false, false,
                actorId, createdAt, null, null, null);
        PollRepository.PollState state = new PollRepository.PollState(
                Map.of(0, 3L, 1, 1L), Set.of(0), 4);
        when(messageRepository.findBuckets(conversationId, null, 257)).thenReturn(List.of(
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
        verify(messageRepository, never()).createIfAbsent(any());
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
        var state = new MessageRepository.PinState(1L, List.of(new MessageRepository.PinSlot((byte) 0, bucket, messageId, Uuids.timeBased())));
        when(messageRepository.changePin(conversationId, bucket, messageId, actorId, true, 0L)).thenReturn(new MessageRepository.PinChange(state, true));

        var result = messages.pinMessage(actorId, conversationId, bucket, messageId, new CanonicalApiContracts.MessagePinRequest("0"));

        assertThat(result.message().isPinned()).isTrue();
        assertThat(result.pinState().revision()).isEqualTo("1");
        verify(messageRepository).changePin(conversationId, bucket, messageId, actorId, true, 0L);
        verify(eventRecorder).record(eq(actorId), eq(conversationId), eq("MESSAGE_PIN"),
                eq("message"), eq(messageId.toString()), any(), any(), any(), any(),
                argThat(payload -> payload.get("messageId").equals(messageId.toString())
                        && payload.get("messageBucket").equals(bucket)
                        && payload.containsKey("isPinned") && payload.get("pinRevision").equals("1")));
    }

    @Test void lostUnpinOwnershipDoesNotPublishFalseSuccess() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
        String bucket = "2026-10-23-08:00";
        when(messageRepository.find(room, bucket, id)).thenReturn(message(room, bucket, id, actor, UUID.randomUUID(), Instant.now()));
        when(messageRepository.changePin(room, bucket, id, actor, false, 0L)).thenThrow(new ConflictException("message pin changed concurrently"));
        assertThatThrownBy(() -> messages.unpinMessage(actor, room, bucket, id, new CanonicalApiContracts.MessagePinRequest("0")))
                .isInstanceOf(ConflictException.class).hasMessageContaining("changed concurrently");
        org.mockito.Mockito.verifyNoInteractions(eventRecorder, realtime);
    }
    @Test void alreadyDesiredPinReturnsSnapshotWithoutDuplicatePublication() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
        String bucket = "2026-10-23-08:00";
        var state = new MessageRepository.PinState(8L, List.of(new MessageRepository.PinSlot((byte) 0, bucket, id, Uuids.timeBased())));
        when(messageRepository.find(room, bucket, id)).thenReturn(message(room, bucket, id, actor, UUID.randomUUID(), Instant.now()));
        when(messageRepository.changePin(room, bucket, id, actor, true, 7L)).thenReturn(new MessageRepository.PinChange(state, false));
        var result = messages.pinMessage(actor, room, bucket, id, new CanonicalApiContracts.MessagePinRequest("7"));
        assertThat(result.pinState().revision()).isEqualTo("8");
        org.mockito.Mockito.verifyNoInteractions(eventRecorder, realtime);
    }
    @Test void pinReadRequiresCurrentMembershipAndKeepsLongRevisionExact() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        when(store.findConversationMember(room, actor)).thenReturn(null);
        assertThatThrownBy(() -> messages.getMessagePins(actor, room))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ForbiddenException.class);
        verify(messageRepository, never()).findPinState(any());
        when(store.findConversationMember(room, actor)).thenReturn(org.mockito.Mockito.mock(CanonicalConversationMember.class));
        when(messageRepository.findPinState(room)).thenReturn(new MessageRepository.PinState(Long.MAX_VALUE, List.of()));
        assertThat(messages.getMessagePins(actor, room).revision()).isEqualTo("9223372036854775807");
    }
    @Test void overflowingExpectedPinRevisionIsRejectedBeforeStorageMutation() {
        assertThatThrownBy(() -> messages.pinMessage(UUID.randomUUID(), UUID.randomUUID(), "2026-10-23-08:00",
                Uuids.timeBased(), new CanonicalApiContracts.MessagePinRequest("9223372036854775808")))
                .isInstanceOf(BadRequestException.class);
        org.mockito.Mockito.verifyNoInteractions(messageRepository);
    }
    @Test void pointAndBucketReadsUsePinAuthorityNotTheMessageFlagProjection() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
        String bucket = "2026-10-23-08:00";
        var projectedUnpinned = message(room, bucket, id, actor, UUID.randomUUID(), Instant.now());
        when(messageRepository.find(room, bucket, id)).thenReturn(projectedUnpinned);
        when(messageRepository.findByBucket(room, bucket, 50)).thenReturn(List.of(projectedUnpinned));
        var pinned = new MessageRepository.PinState(1L, List.of(new MessageRepository.PinSlot((byte) 0, bucket, id, Uuids.timeBased())));
        when(messageRepository.findPinState(room)).thenReturn(pinned);
        assertThat(messages.getMessage(actor, room, bucket, id).isPinned()).isTrue();
        assertThat(messages.listMessages(actor, room, bucket, 50).get(0).isPinned()).isTrue();
        when(messageRepository.find(room, bucket, id)).thenReturn(PublicMessageView.withPinned(projectedUnpinned, true));
        when(messageRepository.findPinState(room)).thenReturn(new MessageRepository.PinState(2L, List.of()));
        assertThat(messages.getMessage(actor, room, bucket, id).isPinned()).isFalse();
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
                null, null, null, List.of(), Set.of(recipientId), false, null));

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
                null, null, null, List.of(), Set.of(outsiderId), false, null)))
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
                null, null, null, List.of(), Set.of(), true, null));

        verify(messageRepository).saveMentions(any(), eq(Set.of(actorId, recipientId)));
    }

    private static CanonicalApiContracts.MessageSendRequest request(UUID clientMessageId, String content) {
        return new CanonicalApiContracts.MessageSendRequest(
                clientMessageId, "TEXT", content, "PLAIN", null, null, null, null,
                null, null, null, List.of(), Set.of(), false, null);
    }

    private static CanonicalMessage message(
            UUID conversationId, String bucket, UUID messageId, UUID senderId, UUID clientMessageId, Instant createdAt) {
        return new CanonicalMessage(
                conversationId, bucket, messageId, senderId, "TEXT", "hello", "PLAIN",
                null, null, null, null, null, null, null, null,
                false, null, null, null, false, false, false, createdAt, clientMessageId, null, null, 0);
    }

    private static CanonicalMessage pollMessage(
            UUID conversationId, UUID pollId, UUID senderId, Instant createdAt) {
        return new CanonicalMessage(
                conversationId, "2026-07-22-01:03", Uuids.timeBased(), senderId, "POLL", "Where next?", "PLAIN",
                null, null, null, pollId, null, null, null, null,
                false, null, null, null, false, false, false, createdAt, UUID.randomUUID(), null, null, 0);
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
