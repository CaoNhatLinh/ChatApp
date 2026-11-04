package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static com.chatapp.chat_service.canonical.call.CallState.*;
import static org.assertj.core.api.Assertions.*;

class CallStateTest {
    final UUID caller = UUID.randomUUID(), callee = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    CallState ringing() { return CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), caller, callee, Type.VOICE, now, UUID.randomUUID()); }
    CallState apply(CallState state, UUID actor, Action action, long seconds) { return state.apply(actor, action, now.plusSeconds(seconds), UUID.randomUUID()); }

    @Test void rejectsReservedIdentityAndSelfCalls() {
        assertThatThrownBy(() -> CallState.ringing(UUID.randomUUID(), SLOT_ID, UUID.randomUUID(), caller, callee, Type.VOICE, now, UUID.randomUUID())).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), caller, caller, Type.VOICE, now, UUID.randomUUID())).isInstanceOf(BadRequestException.class);
    }
    @Test void onlyRecipientCanAcceptAndOutsiderCannotTouchEvenTerminalCalls() {
        var call = ringing();
        assertThatThrownBy(() -> apply(call, caller, Action.ACCEPT, 1)).isInstanceOf(ForbiddenException.class);
        var terminal = apply(call, caller, Action.END, 1);
        assertThatThrownBy(() -> apply(terminal, UUID.randomUUID(), Action.END, 2)).isInstanceOf(ForbiddenException.class);
    }
    @Test void distinguishesCancelDeclineAndMissed() {
        var call = ringing();
        assertThat(apply(call, caller, Action.END, 1).status()).isEqualTo(Status.CANCELLED);
        assertThat(apply(call, callee, Action.LEAVE, 1).status()).isEqualTo(Status.DECLINED);
        assertThat(call.expire(now.plusSeconds(45), UUID.randomUUID()).status()).isEqualTo(Status.MISSED);
        assertThat(call.expire(now.plusSeconds(100), UUID.randomUUID()).endedAt()).isEqualTo(now.plusSeconds(45));
    }
    @Test void lateAcceptCannotBeatDeadlineOrResurrectTerminalCall() {
        var call = ringing();
        var expired = apply(call, callee, Action.ACCEPT, 45);
        assertThat(expired.status()).isEqualTo(Status.MISSED);
        assertThat(apply(expired, callee, Action.ACCEPT, 46)).isSameAs(expired);
    }
    @Test void acceptanceIsNotMediaConnectionAndDuplicateDoesNotMoveTimes() {
        var accepted = apply(ringing(), callee, Action.ACCEPT, 3);
        assertThat(accepted.status()).isEqualTo(Status.ACCEPTED);
        assertThat(accepted.acceptedAt()).isEqualTo(now.plusSeconds(3));
        assertThat(accepted.version()).isEqualTo(2);
        assertThat(apply(accepted, callee, Action.ACCEPT, 4)).isSameAs(accepted);
        assertThat(apply(accepted, caller, Action.LEAVE, 5).version()).isEqualTo(3);
        assertThat(apply(accepted, caller, Action.LEAVE, 5).status()).isEqualTo(Status.ENDED);
        assertThat(apply(accepted, callee, Action.FAIL, 5).status()).isEqualTo(Status.FAILED);
    }
    @Test void ringingHeartbeatCannotExtendInviteOrAcceptOnBehalfOfRecipient() {
        var call = ringing();
        assertThat(apply(call, caller, Action.HEARTBEAT, 40).deadline()).isEqualTo(now.plusSeconds(45));
        assertThatThrownBy(() -> apply(call, callee, Action.HEARTBEAT, 1)).isInstanceOf(ConflictException.class);
    }
    @Test void oneHeartbeatCannotKeepMissingPeerAlive() {
        var accepted = apply(ringing(), callee, Action.ACCEPT, 3);
        var first = apply(accepted, caller, Action.HEARTBEAT, 30);
        assertThat(first.deadline()).isEqualTo(now.plusSeconds(93));
        var both = apply(first, callee, Action.HEARTBEAT, 40);
        assertThat(both.deadline()).isEqualTo(now.plusSeconds(120));
        var lone = apply(both, caller, Action.HEARTBEAT, 100);
        assertThat(lone.deadline()).isEqualTo(now.plusSeconds(130));
        assertThat(apply(lone, caller, Action.HEARTBEAT, 130).status()).isEqualTo(Status.FAILED);
    }
    @Test void terminalReplaysAreStableAndClockRegressionCannotRewriteTimes() {
        var call = ringing();
        assertThat(call.expire(now.plusSeconds(44), UUID.randomUUID())).isSameAs(call);
        assertThatThrownBy(() -> apply(call, caller, Action.END, -1)).isInstanceOf(ConflictException.class);
        var terminal = apply(call, callee, Action.FAIL, 1);
        for (Action action : Action.values()) assertThat(apply(terminal, caller, action, 2)).isSameAs(terminal);
    }
}
