package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class IncomingCallServiceTest {
    final UUID actor = UUID.randomUUID(), caller = UUID.randomUUID(), room = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-22T09:00:00Z");
    final IncomingCallRepository index = mock(IncomingCallRepository.class);
    final CallLifecycleService calls = mock(CallLifecycleService.class);
    IncomingCallService service(Instant at) {
        return new IncomingCallService(index, calls, Clock.fixed(at, ZoneOffset.UTC));
    }
    CallState ringing() {
        return CallState.ringing(room, UUID.randomUUID(), UUID.randomUUID(), caller, actor,
                CallState.Type.VOICE, now, UUID.randomUUID());
    }
    IncomingCallRepository.Key key(CallState call) {
        return new IncomingCallRepository.Key(call.deadline(), call.conversationId(), call.callId());
    }
    void page(CallState call) {
        when(index.page(actor, now, null, 25)).thenReturn(List.of(key(call)));
        when(calls.active(actor, room)).thenReturn(call);
    }

    @Test void returnsOnlyPublicCurrentAuthorityAndNeverStartsOrAnswers() {
        var call = ringing(); page(call);
        var result = service(now).list(actor, null, 25);
        assertThat(result.content()).containsExactly(CallSignalingService.View.of(call));
        assertThat(result.hasNext()).isFalse(); assertThat(result.nextCursor()).isNull();
        verify(calls).active(actor, room); verifyNoMoreInteractions(calls);
        verify(index).page(actor, now, null, 25); verifyNoMoreInteractions(index);
    }
    @Test void ringingHeartbeatRevisionStillMatchesItsFixedEligibilityKey() {
        var call = ringing(); page(call);
        var heartbeat = call.apply(caller, CallState.Action.HEARTBEAT, now.plusSeconds(2), UUID.randomUUID());
        when(calls.active(actor, room)).thenReturn(heartbeat);
        assertThat(heartbeat.deadline()).isEqualTo(call.deadline());
        assertThat(service(now).list(actor, null, 25).content()).containsExactly(CallSignalingService.View.of(heartbeat));
    }
    @Test void staleUncommittedAcceptedTerminalWrongCallAndWrongRecipientAreSkipped() {
        var call = ringing(); page(call);
        var accepted = call.apply(actor, CallState.Action.ACCEPT, now.plusSeconds(1), UUID.randomUUID());
        var ended = call.apply(caller, CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        var otherRecipient = CallState.ringing(room, call.callId(), call.startedOrder(), caller, UUID.randomUUID(), call.callType(), now, UUID.randomUUID());
        var otherCall = ringing();
        for (CallState state : Arrays.asList(null, accepted, ended, otherRecipient, otherCall)) {
            when(calls.active(actor, room)).thenReturn(state);
            assertThat(service(now).list(actor, null, 25).content()).isEmpty();
        }
    }
    @Test void changedTimestampRetryDoesNotReturnSameCallThroughObsoletePointer() {
        var call = ringing(); page(call);
        var retry = CallState.ringing(room, call.callId(), UUID.randomUUID(), caller, actor, call.callType(), now.plusMillis(1), UUID.randomUUID());
        when(calls.active(actor, room)).thenReturn(retry);
        assertThat(service(now).list(actor, null, 25).content()).isEmpty();
    }
    @Test void currentExpiryIsNotRevivedByEarlierTraversalBound() {
        var call = ringing(); page(call);
        when(index.page(actor, call.deadline(), null, 25)).thenReturn(List.of(key(call)));
        assertThat(service(call.deadline()).list(actor, null, 25).content()).isEmpty();
        verify(calls, never()).active(actor, room);
    }
    @Test void accessAndMissingRoomDenialsFilterButAvailabilityAndContentionFailThePage() {
        var call = ringing(); page(call);
        for (RuntimeException denied : List.of(new ForbiddenException("blocked"), new NotFoundException("archived"), new BadRequestException("non-DM"))) {
            doThrow(denied).when(calls).active(actor, room);
            assertThat(service(now).list(actor, null, 25).content()).isEmpty();
        }
        for (RuntimeException failure : List.of(new ConflictException("changed"), new IllegalStateException("authority missing"))) {
            doThrow(failure).when(calls).active(actor, room);
            assertThatThrownBy(() -> service(now).list(actor, null, 25)).isSameAs(failure);
        }
    }
    @Test void emptyFilteredPageRetainsCompleteLastScannedTupleAndOriginalBound() {
        var call = ringing();
        when(index.page(actor, now, null, 1)).thenReturn(List.of(key(call)));
        var first = service(now).list(actor, null, 1);
        assertThat(first.content()).isEmpty(); assertThat(first.hasNext()).isTrue();
        assertThat(first.nextCursor()).isNotBlank();
        when(index.page(actor, now, key(call), 1)).thenReturn(List.of());
        var last = service(now.plusSeconds(1)).list(actor, first.nextCursor(), 1);
        assertThat(last.hasNext()).isFalse(); assertThat(last.nextCursor()).isNull();
        verify(index).page(actor, now, key(call), 1);
        assertThatThrownBy(() -> service(now).list(UUID.randomUUID(), first.nextCursor(), 1)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service(now.plusSeconds(61)).list(actor, first.nextCursor(), 1)).isInstanceOf(BadRequestException.class);
    }
    @Test void rejectsBadLimitsUnauthenticatedAndMalformedScopedCursorBeforeQueries() {
        assertThatThrownBy(() -> service(now).list(null, null, 25)).isInstanceOf(ForbiddenException.class);
        for (int limit : List.of(0, -1, 51, Integer.MAX_VALUE))
            assertThatThrownBy(() -> service(now).list(actor, null, limit)).isInstanceOf(BadRequestException.class);
        String prefix = "incoming-v1|" + actor + "|";
        for (String raw : List.of("bad", prefix + now.plusSeconds(1) + "|" + now.plusSeconds(45) + "|" + room + "|" + UUID.randomUUID(),
                prefix + now + "|" + now + "|" + room + "|" + UUID.randomUUID(),
                prefix + now + "|" + now.plusSeconds(45) + "|" + room + "|" + CallState.SLOT_ID,
                prefix + now.plusNanos(1) + "|" + now.plusSeconds(45) + "|" + room + "|" + UUID.randomUUID())) {
            String cursor = Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
            assertThatThrownBy(() -> service(now).list(actor, cursor, 25)).isInstanceOf(BadRequestException.class);
        }
        assertThatThrownBy(() -> service(now).list(actor, "x".repeat(1025), 25)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(index, calls);
    }
    @Test void invalidOutOfCqlRangeDeadlineIsRejectedBeforeIndexBinding() {
        String raw = "incoming-v1|" + actor + "|" + now + "|" + Instant.MAX.truncatedTo(java.time.temporal.ChronoUnit.MILLIS)
                + "|" + room + "|" + UUID.randomUUID();
        String cursor = Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> service(now).list(actor, cursor, 25)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(index, calls);
    }
    @Test void whitespaceOnlyCursorCannotBypassLengthOrShapeValidation() {
        for (String token : List.of(" ", " ".repeat(1025)))
            assertThatThrownBy(() -> service(now).list(actor, token, 25)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(index, calls);
    }
    @Test void equalDeadlinesContinueThroughTheFullRoomAndCallTuple() {
        var first = ringing();
        var second = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), caller, actor, first.callType(), now, UUID.randomUUID());
        when(index.page(actor, now, null, 1)).thenReturn(List.of(key(first)));
        when(index.page(actor, now, key(first), 1)).thenReturn(List.of(key(second)));
        when(index.page(actor, now, key(second), 1)).thenReturn(List.of());
        when(calls.active(actor, first.conversationId())).thenReturn(first);
        when(calls.active(actor, second.conversationId())).thenReturn(second);
        var one = service(now).list(actor, null, 1);
        var two = service(now.plusSeconds(1)).list(actor, one.nextCursor(), 1);
        var end = service(now.plusSeconds(2)).list(actor, two.nextCursor(), 1);
        assertThat(one.content()).containsExactly(CallSignalingService.View.of(first));
        assertThat(two.content()).containsExactly(CallSignalingService.View.of(second));
        assertThat(end.content()).isEmpty(); assertThat(end.hasNext()).isFalse();
        assertThat(one.nextCursor()).isNotEqualTo(two.nextCursor());
    }
}
