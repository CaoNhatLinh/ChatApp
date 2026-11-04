package com.chatapp.chat_service.canonical.call;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CallRecoveryTest {
    final CallWorkRepository work = mock(CallWorkRepository.class);
    final CallRepository calls = mock(CallRepository.class);
    final CallLifecycleService lifecycle = mock(CallLifecycleService.class);
    final SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
    final CallStatePublisher publisher = new CallStatePublisher(calls, messaging);
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    final CallTimeoutWorker worker = new CallTimeoutWorker(work, calls, lifecycle, publisher, 25, Clock.fixed(now, ZoneOffset.UTC));
    final CallState ringing = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), CallState.Type.VOICE, now.minusSeconds(10), UUID.randomUUID());
    final CallRepository.Slot slot = new CallRepository.Slot(UUID.randomUUID(), ringing.callId());
    CallWorkRepository.Work row(CallState call, CallWorkRepository.Kind kind, Instant lease) {
        return new CallWorkRepository.Work(new CallWorkRepository.Key(kind == CallWorkRepository.Kind.PUBLISH ? Instant.EPOCH : call.deadline(), call.conversationId(), call.callId(), call.revision(), kind), call.deadline(), slot.revision(), lease);
    }
    void authority(CallState state, long receipt) {
        when(calls.find(state.conversationId(), state.callId())).thenReturn(state);
        when(calls.publication(state.conversationId(), state.callId())).thenReturn(new CallRepository.Publication(state, receipt));
    }
    @Test void stateHandoffPrecedesExactReceiptAndHasNoInventedActor() {
        authority(ringing, 0); when(calls.markPublished(ringing, 0)).thenReturn(true);
        assertThat(publisher.publish(ringing)).isTrue();
        var event = ArgumentCaptor.forClass(CallStatePublisher.Event.class);
        var order = inOrder(messaging, calls);
        order.verify(calls).publication(ringing.conversationId(), ringing.callId());
        order.verify(messaging).convertAndSend(anyString(), event.capture(), anyMap());
        order.verify(messaging).convertAndSendToUser(eq(ringing.callerId().toString()), eq("/queue/calls"), eq(event.getValue()), anyMap());
        order.verify(messaging).convertAndSendToUser(eq(ringing.calleeId().toString()), eq("/queue/calls"), eq(event.getValue()), anyMap());
        order.verify(calls).markPublished(ringing, 0);
        assertThat(event.getValue().action()).isEqualTo("STATE");
        assertThat(event.getValue().state().version()).isEqualTo(1);
        assertThat(Arrays.stream(CallStatePublisher.Event.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName)).doesNotContain("actorId", "targetUserId", "signal");
    }
    @Test void brokerFailureCannotAcknowledgeAndReceiptLossKeepsWork() {
        authority(ringing, 0);
        doThrow(new IllegalStateException("private")).when(messaging).convertAndSend(anyString(), any(Object.class), anyMap());
        assertThatThrownBy(() -> publisher.publish(ringing)).isInstanceOf(IllegalStateException.class);
        verify(calls, never()).markPublished(any(), anyLong());
        reset(messaging);
        assertThat(worker.process(row(ringing, CallWorkRepository.Kind.PUBLISH, now))).isFalse();
    }
    @Test void eitherPrivateHandoffFailureKeepsReceiptPendingForSameStateRetry() {
        for (UUID recipient : List.of(ringing.callerId(), ringing.calleeId())) {
            reset(messaging, calls); authority(ringing, 0);
            doThrow(new IllegalStateException("handoff failed")).when(messaging)
                    .convertAndSendToUser(eq(recipient.toString()), eq("/queue/calls"), any(Object.class), anyMap());
            assertThatThrownBy(() -> publisher.publish(ringing)).isInstanceOf(IllegalStateException.class);
            verify(calls, never()).markPublished(any(), anyLong());
            doNothing().when(messaging).convertAndSendToUser(eq(recipient.toString()), eq("/queue/calls"), any(Object.class), anyMap());
            when(calls.markPublished(ringing, 0)).thenReturn(true);
            assertThat(publisher.publish(ringing)).isTrue(); verify(calls).markPublished(ringing, 0);
        }
    }
    @Test void acknowledgedOrSupersededWorkDoesNotRebroadcast() {
        authority(ringing, 1); assertThat(publisher.publish(ringing)).isTrue();
        var terminal = ringing.expire(ringing.deadline(), UUID.randomUUID()); authority(terminal, 0);
        assertThat(publisher.publish(ringing)).isTrue(); verifyNoInteractions(messaging);
    }
    @Test void missingCandidateMustWaitForLeaseAndSuccessfulSlotFence() {
        var row = row(ringing, CallWorkRepository.Kind.PUBLISH, now.plusSeconds(1));
        when(calls.slot(ringing.conversationId())).thenReturn(slot);
        assertThat(worker.process(row)).isFalse(); verify(calls, never()).fenceSlot(any(), any(), any());
        var expired = row(ringing, CallWorkRepository.Kind.PUBLISH, now);
        assertThat(worker.process(expired)).isFalse();
        when(calls.fenceSlot(eq(ringing.conversationId()), eq(slot), any())).thenReturn(true);
        assertThat(worker.process(expired)).isTrue();
    }
    @Test void changedSlotProvesLateWriterCannotCommitButAbsentSlotDoesNot() {
        var row = row(ringing, CallWorkRepository.Kind.PUBLISH, now);
        assertThat(worker.process(row)).isFalse();
        when(calls.slot(ringing.conversationId())).thenReturn(new CallRepository.Slot(UUID.randomUUID(), null));
        assertThat(worker.process(row)).isTrue(); verify(calls, never()).fenceSlot(any(), any(), any());
    }
    @Test void candidateCommitBetweenSnapshotAndSlotReadsMustNotLoseItsPublication() {
        // The first read missed a concurrent commit; the slot now proves it won.
        when(calls.slot(ringing.conversationId())).thenReturn(new CallRepository.Slot(ringing.revision(), ringing.callId()));
        assertThat(worker.process(row(ringing, CallWorkRepository.Kind.PUBLISH, now))).isFalse();
        verify(calls, never()).fenceSlot(any(), any(), any());
    }
    @Test void overduePublicationExpiresInsteadOfReplayingOldRinging() {
        var old = CallState.ringing(ringing.conversationId(), ringing.callId(), UUID.randomUUID(), ringing.callerId(), ringing.calleeId(), CallState.Type.VOICE, now.minusSeconds(60), UUID.randomUUID());
        authority(old, 0);
        assertThat(worker.process(row(old, CallWorkRepository.Kind.PUBLISH, now))).isFalse();
        verify(lifecycle).expire(any()); verifyNoInteractions(messaging);
    }
    @Test void poisonRowIsRetainedButCursorAdvancesThenWrapsForRetry() {
        var progress = new CallWorkRepository.Progress(UUID.randomUUID(), null);
        var one = row(ringing, CallWorkRepository.Kind.PUBLISH, now);
        when(work.progress(0)).thenReturn(progress);
        when(work.page(0, null, now, 25)).thenReturn(List.of(one));
        when(calls.find(any(), any())).thenThrow(new IllegalStateException("private"));
        worker.scan(0);
        verify(work, never()).remove(any()); verify(work).advance(0, progress, one.key());
        var next = new CallWorkRepository.Progress(UUID.randomUUID(), one.key());
        when(work.progress(0)).thenReturn(next); when(work.page(0, one.key(), now, 25)).thenReturn(List.of());
        worker.scan(0); verify(work).advance(0, next, null);
    }
    @Test void emptyInitialShardDoesNotContinuouslyRewriteCheckpoint() {
        var progress = new CallWorkRepository.Progress(UUID.randomUUID(), null);
        when(work.progress(0)).thenReturn(progress); when(work.page(0, null, now, 25)).thenReturn(List.of());
        worker.scan(0); verify(work, never()).advance(anyInt(), any(), any());
    }
    @Test void timeoutUsesExactAuthorityRevisionAndIsRetainedOnCasLoss() {
        var old = CallState.ringing(ringing.conversationId(), ringing.callId(), UUID.randomUUID(), ringing.callerId(), ringing.calleeId(), CallState.Type.VOICE, now.minusSeconds(60), UUID.randomUUID());
        authority(old, 0);
        var row = row(old, CallWorkRepository.Kind.EXPIRE, now);
        var expected = new CallRepository.Expiry(old.deadline(), old.conversationId(), old.callId(), old.revision(), slot.revision());
        assertThat(worker.process(row)).isFalse();
        when(lifecycle.expire(expected)).thenReturn(true);
        assertThat(worker.process(row)).isTrue();
        verifyNoInteractions(messaging);
    }
    @Test void acknowledgedTerminalWorkIsRemovedOnlyByItsExactKey() {
        var terminal = ringing.expire(ringing.deadline(), UUID.randomUUID()); authority(terminal, terminal.version());
        var row = row(terminal, CallWorkRepository.Kind.PUBLISH, now);
        var progress = new CallWorkRepository.Progress(UUID.randomUUID(), null);
        when(work.progress(0)).thenReturn(progress); when(work.page(0, null, now, 25)).thenReturn(List.of(row));
        worker.scan(0); verify(work).remove(row.key()); verifyNoInteractions(messaging);
    }
    @Test void lateWriterCannotCommitAfterOrphanFenceAndActiveCallIsPreserved() {
        var memory = new CallLifecycleServiceTest.MemoryCalls(); memory.initialize(ringing.conversationId());
        var initial = memory.slot(ringing.conversationId());
        assertThat(memory.fenceSlot(ringing.conversationId(), initial, UUID.randomUUID())).isTrue();
        assertThat(memory.claim(initial, ringing)).isFalse();
        assertThat(memory.claim(memory.slot(ringing.conversationId()), ringing)).isTrue();
        var active = memory.slot(ringing.conversationId());
        assertThat(memory.fenceSlot(ringing.conversationId(), active, UUID.randomUUID())).isTrue();
        assertThat(memory.slot(ringing.conversationId()).activeCallId()).isEqualTo(ringing.callId());
        assertThat(memory.find(ringing.conversationId(), ringing.callId())).isEqualTo(ringing);
    }
}
