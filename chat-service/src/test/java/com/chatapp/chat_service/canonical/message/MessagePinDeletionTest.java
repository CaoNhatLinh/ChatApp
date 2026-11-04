package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.poll.PollRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.service.*;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessagePinDeletionTest {
    private final MessageRepository messageRepository = mock(MessageRepository.class);
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    private final CanonicalEventRecorder eventRecorder = mock(CanonicalEventRecorder.class);
    private final RealtimePublisher realtime = mock(RealtimePublisher.class);
    private final MessageService messages = new MessageService(store, mock(CanonicalConversationRepository.class),
            authorization, eventRecorder, mock(ChatPolicyService.class), realtime, mock(NotificationService.class),
            mock(PollRepository.class), messageRepository, mock(UserRepository.class), mock(MessageAttachmentPolicy.class),
            mock(MessageStickerPolicy.class), mock(MessageReplyPolicy.class), mock(MessageForwardPolicy.class));

    @Test
    void deletedMessageRetryReleasesItsPinAndPublishesVersionedState() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        var deleted = deletedMessage(actor, room);
        var before = new MessageRepository.PinState(4, List.of(new MessageRepository.PinSlot(
                (byte) 0, deleted.messageBucket(), deleted.messageId(), Uuids.timeBased())));
        var after = new MessageRepository.PinState(5, List.of());
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenReturn(deleted);
        when(messageRepository.findPinState(room)).thenReturn(before);
        when(messageRepository.changePin(room, deleted.messageBucket(), deleted.messageId(), actor, false, 4))
                .thenReturn(new MessageRepository.PinChange(after, true));

        var result = messages.deleteMessage(actor, room, deleted.messageBucket(), deleted.messageId());

        assertThat(result.content()).isEmpty();
        assertThat(result.isPinned()).isFalse();
        verify(messageRepository).changePin(room, deleted.messageBucket(), deleted.messageId(), actor, false, 4);
        verify(messageRepository, never()).delete(any(), any(), any(), any());
        verify(realtime).publishToConversation(room, "/pins",
                new CanonicalApiContracts.MessagePinStateView(room, "5", List.of()));
        verify(eventRecorder).record(eq(actor), eq(room), eq("MESSAGE_UNPIN"), eq("message"),
                eq(deleted.messageId().toString()), any(), any(), any(), any(),
                argThat(payload -> payload.get("pinRevision").equals("5") && Boolean.TRUE.equals(payload.get("isDeleted"))
                        && payload.get("content").equals("")));
        verify(authorization, never()).requirePermission(room, actor, ConversationPermission.MESSAGE_PIN);
    }

    @Test void newDeletionReleasesItsPinWithoutRequiringPinPermission() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        var deleted = deletedMessage(actor, room);
        var live = liveMessage(deleted);
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenReturn(live, deleted);
        when(messageRepository.delete(room, deleted.messageBucket(), deleted.messageId(), actor)).thenReturn(true);
        when(messageRepository.findPinState(room)).thenReturn(new MessageRepository.PinState(4, List.of(
                new MessageRepository.PinSlot((byte) 0, deleted.messageBucket(), deleted.messageId(), Uuids.timeBased()))));
        when(messageRepository.changePin(room, deleted.messageBucket(), deleted.messageId(), actor, false, 4))
                .thenReturn(new MessageRepository.PinChange(new MessageRepository.PinState(5, List.of()), true));

        assertThat(messages.deleteMessage(actor, room, deleted.messageBucket(), deleted.messageId()).isDeleted()).isTrue();
        verify(realtime).publishToConversation(room, "/pins", new CanonicalApiContracts.MessagePinStateView(room, "5", List.of()));
        verify(authorization).requirePermission(room, actor, ConversationPermission.MESSAGE_DELETE_OWN);
        verify(authorization, never()).requirePermission(room, actor, ConversationPermission.MESSAGE_PIN);
    }

    @Test void losingConcurrentDeleteReturnsTheCommittedTombstoneWithoutRepeatingDeletePublication() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        var deleted = deletedMessage(actor, room);
        var live = liveMessage(deleted);
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenReturn(live, deleted);
        when(messageRepository.delete(room, deleted.messageBucket(), deleted.messageId(), actor)).thenReturn(false);
        when(messageRepository.findPinState(room)).thenReturn(new MessageRepository.PinState(2, List.of()));
        var result = messages.deleteMessage(actor, room, deleted.messageBucket(), deleted.messageId());
        assertThat(result.isDeleted()).isTrue();
        assertThat(result.content()).isEmpty();
        org.mockito.Mockito.verifyNoInteractions(realtime, eventRecorder);
    }

    @Test void concurrentDeletionAfterPinCommitReleasesSlotInsteadOfReportingPinnedSuccess() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        var deleted = deletedMessage(actor, room);
        var live = liveMessage(deleted);
        var pinned = new MessageRepository.PinState(1, List.of(new MessageRepository.PinSlot(
                (byte) 0, deleted.messageBucket(), deleted.messageId(), Uuids.timeBased())));
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenReturn(live, deleted);
        when(messageRepository.changePin(room, deleted.messageBucket(), deleted.messageId(), actor, true, 0))
                .thenReturn(new MessageRepository.PinChange(pinned, true));
        when(messageRepository.findPinState(room)).thenReturn(pinned);
        when(messageRepository.changePin(room, deleted.messageBucket(), deleted.messageId(), actor, false, 1))
                .thenReturn(new MessageRepository.PinChange(new MessageRepository.PinState(2, List.of()), true));

        assertThatThrownBy(() -> messages.pinMessage(actor, room, deleted.messageBucket(), deleted.messageId(),
                new CanonicalApiContracts.MessagePinRequest("0")))
                .isInstanceOf(ConflictException.class).hasMessageContaining("deleted during pin");
        verify(realtime).publishToConversation(room, "/pins", new CanonicalApiContracts.MessagePinStateView(room, "2", List.of()));
        verify(eventRecorder, never()).record(any(), any(), eq("MESSAGE_PIN"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void memberPinSnapshotRepairsADeletedSlotLeftByInterruptedWork() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        var deleted = deletedMessage(actor, room);
        when(store.findConversationMember(room, actor)).thenReturn(org.mockito.Mockito.mock(CanonicalConversationMember.class));
        var before = new MessageRepository.PinState(7, List.of(new MessageRepository.PinSlot(
                (byte) 0, deleted.messageBucket(), deleted.messageId(), Uuids.timeBased())));
        var after = new MessageRepository.PinState(8, List.of());
        when(messageRepository.findPinState(room)).thenReturn(before, before, after);
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenReturn(deleted);
        when(messageRepository.changePin(room, deleted.messageBucket(), deleted.messageId(), actor, false, 7))
                .thenReturn(new MessageRepository.PinChange(after, true));

        assertThat(messages.getMessagePins(actor, room)).isEqualTo(
                new CanonicalApiContracts.MessagePinStateView(room, "8", List.of()));
        verify(realtime).publishToConversation(room, "/pins", new CanonicalApiContracts.MessagePinStateView(room, "8", List.of()));
        verify(authorization, never()).requirePermission(room, actor, ConversationPermission.MESSAGE_PIN);
    }

    @Test void memberPinSnapshotDoesNotTreatMissingSourceAsDeletionProof() {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
        when(store.findConversationMember(room, actor)).thenReturn(org.mockito.Mockito.mock(CanonicalConversationMember.class));
        when(messageRepository.findPinState(room)).thenReturn(new MessageRepository.PinState(9, List.of(
                new MessageRepository.PinSlot((byte) 0, "2026-10-23-08:00", id, Uuids.timeBased()))));
        var view = messages.getMessagePins(actor, room);
        assertThat(view.revision()).isEqualTo("9");
        assertThat(view.pins()).hasSize(1);
        verify(messageRepository, never()).changePin(any(), any(), any(), any(), any(Boolean.class), any(Long.class));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void twoThreadsDeleteBeforeOrAfterPinCommitConvergeWithoutPinnedSuccess(boolean pauseAfterCommit) throws Exception {
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        var deleted = deletedMessage(actor, room);
        var live = liveMessage(deleted);
        var authority = new AtomicReference<>(live);
        var pinAuthority = new AtomicReference<>(new MessageRepository.PinState(0, List.of()));
        var reached = new CountDownLatch(1);
        var resume = new CountDownLatch(1);
        when(messageRepository.find(room, deleted.messageBucket(), deleted.messageId())).thenAnswer(call -> authority.get());
        when(messageRepository.findPinState(room)).thenAnswer(call -> pinAuthority.get());
        when(messageRepository.delete(room, deleted.messageBucket(), deleted.messageId(), actor)).thenAnswer(call -> {
            authority.set(deleted);
            return true;
        });
        when(messageRepository.changePin(room, deleted.messageBucket(), deleted.messageId(), actor, true, 0)).thenAnswer(call -> {
            if (!pauseAfterCommit) { reached.countDown(); assertThat(resume.await(5, TimeUnit.SECONDS)).isTrue(); }
            var committed = new MessageRepository.PinState(1, List.of(new MessageRepository.PinSlot(
                    (byte) 0, deleted.messageBucket(), deleted.messageId(), Uuids.timeBased())));
            pinAuthority.set(committed);
            if (pauseAfterCommit) { reached.countDown(); assertThat(resume.await(5, TimeUnit.SECONDS)).isTrue(); }
            return new MessageRepository.PinChange(committed, true);
        });
        when(messageRepository.changePin(eq(room), eq(deleted.messageBucket()), eq(deleted.messageId()), eq(actor), eq(false), any(Long.class)))
                .thenAnswer(call -> {
                    var prior = pinAuthority.get();
                    assertThat((long) call.getArgument(5)).isEqualTo(prior.revision());
                    var committed = new MessageRepository.PinState(prior.revision() + 1, List.of());
                    pinAuthority.set(committed);
                    return new MessageRepository.PinChange(committed, true);
                });
        var workers = Executors.newFixedThreadPool(2);
        try {
            var pin = workers.submit(() -> messages.pinMessage(actor, room, deleted.messageBucket(), deleted.messageId(),
                    new CanonicalApiContracts.MessagePinRequest("0")));
            assertThat(reached.await(5, TimeUnit.SECONDS)).isTrue();
            var deletion = workers.submit(() -> messages.deleteMessage(actor, room, deleted.messageBucket(), deleted.messageId()));
            assertThat(deletion.get(5, TimeUnit.SECONDS).isDeleted()).isTrue();
            resume.countDown();
            assertThatThrownBy(() -> pin.get(5, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(ConflictException.class);
            assertThat(pinAuthority.get().slots()).isEmpty();
            assertThat(pinAuthority.get().revision()).isEqualTo(2);
            verify(eventRecorder, never()).record(any(), any(), eq("MESSAGE_PIN"), any(), any(), any(), any(), any(), any(), any());
        } finally {
            resume.countDown();
            workers.shutdownNow();
        }
    }

    private static CanonicalMessage deletedMessage(UUID actor, UUID room) {
        return new CanonicalMessage(room, "2026-10-23-08:00", Uuids.timeBased(), actor, "TEXT", "retained", "PLAIN",
                null, null, null, null, null, null, null, null, true, actor, Instant.now(), null,
                false, false, false, Instant.now(), UUID.randomUUID(), null, null, 1);
    }

    private static CanonicalMessage liveMessage(CanonicalMessage m) {
        return new CanonicalMessage(m.conversationId(), m.messageBucket(), m.messageId(), m.senderId(), "TEXT", "original", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null,
                false, false, false, m.createdAt(), m.clientMessageId(), null, null, 0);
    }
}
