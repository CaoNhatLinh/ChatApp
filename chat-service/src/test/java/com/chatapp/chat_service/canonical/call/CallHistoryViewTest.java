package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class CallHistoryViewTest {
    final UUID caller = UUID.randomUUID(), callee = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-23T09:00:00Z");
    final CallState ringing = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), Uuids.startOf(now.toEpochMilli()),
            caller, callee, CallState.Type.VIDEO, now, UUID.randomUUID());
    @Test void ringingCancelDeclineAndFailureRemainDistinctForBothParticipants() {
        var cancelled = ringing.apply(caller, CallState.Action.END, now, UUID.randomUUID());
        var declined = ringing.apply(callee, CallState.Action.LEAVE, now, UUID.randomUUID());
        var failed = ringing.apply(caller, CallState.Action.FAIL, now, UUID.randomUUID());
        for (UUID actor : new UUID[]{caller, callee}) {
            assertThat(CallHistoryView.of(ringing, actor).outcome()).isEqualTo(CallHistoryView.Outcome.RINGING);
            assertThat(CallHistoryView.of(cancelled, actor).outcome()).isEqualTo(CallHistoryView.Outcome.CANCELLED);
            assertThat(CallHistoryView.of(declined, actor).outcome()).isEqualTo(CallHistoryView.Outcome.DECLINED);
            assertThat(CallHistoryView.of(failed, actor).outcome()).isEqualTo(CallHistoryView.Outcome.FAILED);
        }
    }
    @Test void acceptedLeaseTimeoutIsFailureNotMissedAndRetainsOnlyConsent() {
        var accepted = ringing.apply(callee, CallState.Action.ACCEPT, now.plusSeconds(1), UUID.randomUUID());
        var failed = accepted.expire(accepted.deadline(), UUID.randomUUID());
        var view = CallHistoryView.of(failed, callee);
        assertThat(view.outcome()).isEqualTo(CallHistoryView.Outcome.FAILED);
        assertThat(view.acceptedAt()).isEqualTo(accepted.acceptedAt());
        assertThat(view.participants().get(1).initiatedAt()).isNull();
        assertThat(view.participants().get(1).acceptedAt()).isEqualTo(accepted.acceptedAt());
        assertThatThrownBy(() -> view.participants().clear()).isInstanceOf(UnsupportedOperationException.class);
    }
    @Test void thirdPartyCannotConvertAuthorityIntoTheirHistory() {
        assertThatThrownBy(() -> CallHistoryView.of(ringing, UUID.randomUUID())).isInstanceOf(ForbiddenException.class);
    }
}
