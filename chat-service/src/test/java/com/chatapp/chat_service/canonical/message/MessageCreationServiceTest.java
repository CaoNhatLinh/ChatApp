package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.repository.*;
import com.chatapp.chat_service.canonical.service.*;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.poll.PollRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.canonical.sticker.StickerCatalogService;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageCreationServiceTest {
    final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    final CanonicalConversationRepository conversationRepository = mock(CanonicalConversationRepository.class);
    final MessageRepository messageRepository = mock(MessageRepository.class);
    final UserRepository userRepository = mock(UserRepository.class);
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final CanonicalEventRecorder eventRecorder = mock(CanonicalEventRecorder.class);
    final RealtimePublisher realtime = mock(RealtimePublisher.class);
    final NotificationService notifications = mock(NotificationService.class);
    final MessageService messages;
    MessageCreationServiceTest() {
        when(store.findConversation(any())).thenReturn(mock(CanonicalConversation.class));
        when(authorization.requireMember(any(), any())).thenReturn(mock(CanonicalConversationMember.class));
        when(authorization.effectivePermissions(any(), any())).thenReturn(Set.of(ConversationPermission.MESSAGE_SEND));
        when(messageRepository.createIfAbsent(any())).thenReturn(true);
        messages = new MessageService(store, conversationRepository, authorization, eventRecorder,
                mock(ChatPolicyService.class), realtime, notifications, mock(PollRepository.class), messageRepository,
                userRepository, mock(MessageAttachmentPolicy.class), new MessageStickerPolicy(mock(StickerCatalogService.class)),
                new MessageReplyPolicy(messageRepository, mock(FriendshipRepository.class)),
                new MessageForwardPolicy(messageRepository, authorization, mock(FriendshipRepository.class)));
    }

    private static CanonicalApiContracts.MessageSendRequest request(UUID client, String content) {
        return new CanonicalApiContracts.MessageSendRequest(client, "TEXT", content, "PLAIN", null, null,
                null, null, null, null, null, List.of(), Set.of(), false, null);
    }

    @Test void workerLosingAuthorityCreationReturnsTheCurrentEditNotItsStaleDraft() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        var current = racedMessage(actor, room, client, id, false);
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any())).thenReturn(
                new MessageRepository.MessageClaim(id, current.messageBucket(), current.createdAt(), false, true));
        when(messageRepository.find(room, current.messageBucket(), id)).thenReturn(null, current);
        when(messageRepository.createIfAbsent(any())).thenReturn(false);
        var result = messages.sendMessage(actor, room, request(client, "stale draft"));
        assertThat(result).isSameAs(current); assertThat(result.content()).isEqualTo("newer edit");
        verify(messageRepository).createIfAbsent(argThat(candidate -> candidate.content().equals("stale draft")));
        verify(messageRepository).repairSourceProjections(current);
        org.mockito.Mockito.verifyNoInteractions(eventRecorder, realtime, notifications);
        verify(store, never()).updateLastMessageProjections(any(), any(), any());
    }

    @Test void idempotencyClaimWinnerCanLoseAuthorityCreationAndMustPreserveDeletion() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        var deleted = racedMessage(actor, room, client, id, true);
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any())).thenReturn(
                new MessageRepository.MessageClaim(id, deleted.messageBucket(), deleted.createdAt(), true, true));
        when(messageRepository.createIfAbsent(any())).thenReturn(false);
        when(messageRepository.find(room, deleted.messageBucket(), id)).thenReturn(deleted);
        var result = messages.sendMessage(actor, room, request(client, "stale draft"));
        assertThat(result.isDeleted()).isTrue(); assertThat(result.content()).isEmpty();
        verify(store).repairCanonicalConversationPreview(eq(result), isNull());
        verify(store, never()).updateLastMessageProjections(any(), any(), any());
        verify(messageRepository, never()).repairSourceProjections(any());
        verify(messageRepository, never()).saveAttachment(any(), any());
        org.mockito.Mockito.verifyNoInteractions(eventRecorder, realtime, notifications);
    }

    @Test void unappliedCreationWithMissingAuthorityIsAConflictNotASuccessOrUnconditionalWrite() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any())).thenReturn(
                new MessageRepository.MessageClaim(id, "2026-10-23-08:00", Instant.now(), true, true));
        when(messageRepository.createIfAbsent(any())).thenReturn(false);
        assertThatThrownBy(() -> messages.sendMessage(actor, room, request(client, "hello"))).isInstanceOf(ConflictException.class);
        verify(messageRepository).createIfAbsent(any());
        verify(messageRepository, never()).saveBucket(any());
        verify(messageRepository, never()).repairSourceProjections(any());
        org.mockito.Mockito.verifyNoInteractions(eventRecorder, realtime, notifications);
    }

    @Test void ambiguousCreationFailureDoesNotFallBackToAnUnconditionalWrite() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any())).thenReturn(
                new MessageRepository.MessageClaim(id, "2026-10-23-08:00", Instant.now(), true, true));
        org.mockito.Mockito.doThrow(new IllegalStateException("conditional write outcome unknown"))
                .when(messageRepository).createIfAbsent(any());
        assertThatThrownBy(() -> messages.sendMessage(actor, room, request(client, "hello"))).isInstanceOf(IllegalStateException.class);
        verify(messageRepository).createIfAbsent(any());
        verify(messageRepository, never()).saveBucket(any());
        org.mockito.Mockito.verifyNoInteractions(eventRecorder, realtime, notifications);
    }

    @Test void recoveredClaimWhoseWorkerCreatesAuthorityProjectsAndPublishes() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = Uuids.timeBased();
        when(messageRepository.claim(eq(actor), eq(client), eq(room), any(), any(), any())).thenReturn(
                new MessageRepository.MessageClaim(id, "2026-10-23-08:00", Instant.now(), false, true));
        var sender = mock(CanonicalUser.class);
        when(sender.displayName()).thenReturn("Sender");
        when(userRepository.findById(actor)).thenReturn(sender);
        when(conversationRepository.findMembers(room)).thenReturn(List.of());
        var result = messages.sendMessage(actor, room, request(client, "hello"));
        assertThat(result.messageId()).isEqualTo(id);
        var order = org.mockito.Mockito.inOrder(messageRepository, store, realtime);
        order.verify(messageRepository).createIfAbsent(result);
        order.verify(messageRepository).saveBucket(result);
        order.verify(messageRepository).repairSourceProjections(result);
        order.verify(store).updateLastMessageProjections(eq(result), any(), any());
        order.verify(realtime).publishToConversation(eq(room), eq(""), any());
    }

    private static CanonicalMessage racedMessage(UUID actor, UUID room, UUID client, UUID id, boolean deleted) {
        return new CanonicalMessage(room, "2026-10-23-08:00", id, actor, "TEXT", "newer edit", "PLAIN",
                null, null, null, null, null, null, null, null, deleted, deleted ? actor : null,
                deleted ? Instant.now() : null, Instant.now(), false, false, false, Instant.now(), client, null, null, deleted ? 2 : 1);
    }

}
