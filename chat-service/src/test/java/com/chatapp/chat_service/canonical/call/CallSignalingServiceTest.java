package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.chatapp.chat_service.canonical.call.CallSignalingService.*;

class CallSignalingServiceTest {
    final CallLifecycleService calls = mock(CallLifecycleService.class);
    final SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
    final CallStatePublisher publisher = mock(CallStatePublisher.class);
    final CallSignalingService signaling = new CallSignalingService(calls, messaging, publisher);
    CallSignalingServiceTest() { when(publisher.publish(any())).thenReturn(true); }
    final UUID caller = UUID.randomUUID(), callee = UUID.randomUUID(), room = UUID.randomUUID(), id = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    final CallState ringing = CallState.ringing(room, id, UUID.randomUUID(), caller, callee, CallState.Type.VOICE, now, UUID.randomUUID());
    final CallState accepted = ringing.apply(callee, CallState.Action.ACCEPT, now.plusSeconds(1), UUID.randomUUID());
    Command command(Map<String, Object> signal) { return new Command(UUID.randomUUID(), room, id, "VOICE", callee, signal); }
    @SuppressWarnings("unchecked") Map<String, Object> event() {
        var captured = ArgumentCaptor.forClass(Map.class);
        var headers = ArgumentCaptor.forClass(org.springframework.messaging.MessageHeaders.class);
        verify(messaging).convertAndSend(eq("/topic/conversation/" + room + "/calls"), captured.capture(), headers.capture());
        assertThat(CallDeliveryHeaders.read(headers.getValue()).kind()).isEqualTo(CallDelivery.Kind.SIGNAL);
        verify(messaging, never()).convertAndSendToUser(anyString(), eq("/queue/calls"), any(Object.class), anyMap());
        return captured.getValue();
    }

    @Test void startAcknowledgesCanonicalSnapshotAndBroadcastsOnlyAfterAuthority() {
        var command = command(null); when(calls.start(caller, room, id, callee, CallState.Type.VOICE)).thenReturn(ringing);
        var result = signaling.execute(caller, Action.START, command);
        assertThat(result.accepted()).isTrue(); assertThat(result.requestId()).isEqualTo(command.requestId());
        assertThat(result.state().status()).isEqualTo(CallState.Status.RINGING);
        assertThat(result.state().version()).isEqualTo(1);
        var order = inOrder(calls, publisher);
        order.verify(calls).start(caller, room, id, callee, CallState.Type.VOICE);
        order.verify(publisher).publish(ringing);
        verifyNoInteractions(messaging);
    }
    @Test void aTerminalStartReplayPublishesEndNotAnotherRingingInvite() {
        var ended = ringing.apply(caller, CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        when(calls.start(caller, room, id, callee, CallState.Type.VOICE)).thenReturn(ended);
        assertThat(signaling.execute(caller, Action.START, command(null)).state().status()).isEqualTo(CallState.Status.CANCELLED);
        verify(publisher).publish(ended); verifyNoInteractions(messaging);
    }
    @Test void wrongTargetDoesNotMutateOrFanOut() {
        when(calls.get(caller, room, id)).thenReturn(ringing);
        var c = new Command(UUID.randomUUID(), room, id, null, UUID.randomUUID(), null);
        var result = signaling.execute(caller, Action.JOIN, c);
        assertThat(result.errorCode()).isEqualTo("FORBIDDEN"); assertThat(result.state()).isNull();
        verify(calls, never()).change(any(), any(), any(), any()); verifyNoInteractions(messaging);
    }
    @Test void invalidKeysAndTypeFailBeforeAnyAuthorityLookup() {
        assertThat(signaling.execute(caller, Action.START, null).errorCode()).isEqualTo("INVALID");
        assertThat(signaling.execute(caller, Action.START, new Command(UUID.randomUUID(), room, CallState.SLOT_ID, "VOICE", callee, null)).errorCode()).isEqualTo("INVALID");
        assertThat(signaling.execute(caller, Action.START, new Command(UUID.randomUUID(), room, id, "OTHER", callee, null)).errorCode()).isEqualTo("INVALID");
        verifyNoInteractions(calls, messaging);
    }
    @Test void errorsAreCorrelatedAndSanitizedWithoutBroadcastingSecrets() {
        var command = command(null);
        var errors = Map.of(new ForbiddenException("secret"), "FORBIDDEN", new NotFoundException("secret"), "NOT_FOUND",
                new ConflictException("secret"), "CONFLICT", new IllegalStateException("private SDP"), "UNAVAILABLE");
        for (var entry : errors.entrySet()) {
            doThrow(entry.getKey()).when(calls).start(caller, room, id, callee, CallState.Type.VOICE);
            var result = signaling.execute(caller, Action.START, command);
            assertThat(result.accepted()).isFalse(); assertThat(result.requestId()).isEqualTo(command.requestId());
            assertThat(result.errorCode()).isEqualTo(entry.getValue());
            assertThat(result.toString()).doesNotContain("secret", "private SDP"); assertThat(result.state()).isNull();
        }
        verifyNoInteractions(messaging);
    }
    @Test void fanOutFailureReportsUncertaintyWithoutASecondMutation() {
        when(calls.start(caller, room, id, callee, CallState.Type.VOICE)).thenReturn(ringing);
        doThrow(new IllegalStateException("broker down")).when(publisher).publish(ringing);
        var result = signaling.execute(caller, Action.START, command(null));
        assertThat(result.errorCode()).isEqualTo("UNAVAILABLE");
        verify(calls).start(caller, room, id, callee, CallState.Type.VOICE); verifyNoMoreInteractions(calls);
    }
    @Test void stateSyncRebroadcastsCurrentVersionRatherThanRepeatingAMutation() {
        when(calls.get(caller, room, id)).thenReturn(accepted);
        var result = signaling.execute(caller, Action.SYNC, command(null));
        assertThat(result.state().version()).isEqualTo(2); verify(publisher).publish(accepted);
        verify(calls, never()).change(any(), any(), any(), any());
    }
    @Test void eachControlDispatchesTheNamedTransition() {
        when(calls.get(caller, room, id)).thenReturn(accepted);
        var actions = Map.of(Action.JOIN, CallState.Action.ACCEPT, Action.END, CallState.Action.END,
                Action.LEAVE, CallState.Action.LEAVE, Action.FAIL, CallState.Action.FAIL, Action.HEARTBEAT, CallState.Action.HEARTBEAT);
        for (var entry : actions.entrySet()) {
            when(calls.change(caller, room, id, entry.getValue())).thenReturn(accepted);
            assertThat(signaling.execute(caller, entry.getKey(), command(null)).accepted()).isTrue();
            verify(calls).change(caller, room, id, entry.getValue());
        }
    }
    @Test void signalingRequiresAcceptedAuthorityAndCorrectCallerSdpRole() {
        when(calls.get(caller, room, id)).thenReturn(accepted);
        when(calls.authorizeSignal(caller, room, id, callee)).thenReturn(accepted);
        var command = command(Map.of("kind", "sdp", "description", Map.of("type", "offer", "sdp", "v=0\r\n", "untrusted", "discard"), "untrusted", "discard"));
        assertThat(signaling.execute(caller, Action.SIGNAL, command).accepted()).isTrue();
        assertThat(event()).containsEntry("action", "SIGNAL").containsEntry("signal", Map.of("kind", "sdp", "description", Map.of("type", "offer", "sdp", "v=0\r\n")));
        clearInvocations(messaging);
        assertThat(signaling.execute(caller, Action.SIGNAL, command(Map.of("kind", "sdp", "description", Map.of("type", "answer", "sdp", "v=0")))).errorCode()).isEqualTo("INVALID");
        verifyNoInteractions(messaging);
    }
    @Test void rejectedSignalAuthorityCannotLeakAnyPayload() {
        when(calls.get(caller, room, id)).thenReturn(ringing);
        when(calls.authorizeSignal(caller, room, id, callee)).thenThrow(new ConflictException("not accepted"));
        assertThat(signaling.execute(caller, Action.SIGNAL, command(Map.of("kind", "sdp"))).errorCode()).isEqualTo("CONFLICT");
        verifyNoInteractions(messaging);
    }
    @Test void iceIsBoundedAndUnknownFieldsAreNeverRelayed() {
        when(calls.get(caller, room, id)).thenReturn(accepted);
        when(calls.authorizeSignal(caller, room, id, callee)).thenReturn(accepted);
        var signal = Map.<String, Object>of("kind", "ice", "candidate", Map.of("candidate", "candidate:1", "sdpMid", "0", "sdpMLineIndex", 0, "extra", "discard"));
        assertThat(signaling.execute(caller, Action.SIGNAL, command(signal)).accepted()).isTrue();
        assertThat(event().get("signal").toString()).doesNotContain("discard", "extra");
        clearInvocations(messaging);
        assertThat(signaling.execute(caller, Action.SIGNAL, command(Map.of("kind", "ice", "candidate", Map.of("candidate", "x".repeat(8193))))).errorCode()).isEqualTo("INVALID");
        verifyNoInteractions(messaging);
    }
}
