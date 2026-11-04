package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.common.exception.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CallHistoryServiceTest {
    final UUID room = UUID.randomUUID(), caller = UUID.randomUUID(), callee = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-23T09:00:00Z");
    final YearMonth month = YearMonth.of(2026, 10);
    final CallHistoryRepository index = mock(CallHistoryRepository.class);
    final CallRepository calls = mock(CallRepository.class);
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    final CallLifecycleService lifecycle = mock(CallLifecycleService.class);
    final CanonicalConversation conversation = mock(CanonicalConversation.class);
    final CallHistoryService history = new CallHistoryService(index, calls, authorization, store, lifecycle, Clock.fixed(now, ZoneOffset.UTC));
    CallHistoryServiceTest() {
        when(store.findConversation(room)).thenReturn(conversation);
        when(conversation.conversationType()).thenReturn("DM");
    }
    CallState ringing() { return CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(now.toEpochMilli()), caller, callee, CallState.Type.VOICE, now, UUID.randomUUID()); }
    CallState ended() { return ringing().apply(caller, CallState.Action.END, now, UUID.randomUUID()); }
    CallHistoryRepository.Key key(CallState state) { return new CallHistoryRepository.Key(state.startedOrder(), state.conversationId(), state.callId()); }
    void own(CallState state, UUID actor, int limit) {
        when(index.own(eq(actor), eq(month), isNull(), eq(limit))).thenReturn(List.of(key(state)));
        when(calls.find(room, state.callId())).thenReturn(state);
    }
    String token(UUID actor, UUID scope, String selectedMonth, CallHistoryRepository.Key key) {
        String raw = "history-v1|" + actor + "|" + (scope == null ? "own" : scope) + "|" + selectedMonth
                + "|" + key.startedOrder() + "|" + key.conversationId() + "|" + key.callId();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    @Test void ownHistoryHydratesLatestAuthorityAndReturnsOnlyPublicFacts() {
        var state = ended(); own(state, caller, 25);
        var result = history.own(caller, "2026-10", null, 25);
        assertThat(result.content()).hasSize(1);
        var view = result.content().get(0);
        assertThat(view.direction()).isEqualTo(CallHistoryView.Direction.OUTGOING);
        assertThat(view.outcome()).isEqualTo(CallHistoryView.Outcome.CANCELLED);
        assertThat(view.version()).isEqualTo(state.version());
        assertThat(view.participants()).containsExactly(
                new CallHistoryView.Participant(caller, CallHistoryView.Role.CALLER, state.createdAt(), null),
                new CallHistoryView.Participant(callee, CallHistoryView.Role.CALLEE, null, null));
        assertThat(result.hasNext()).isFalse(); assertThat(result.nextCursor()).isNull();
        verify(authorization).requireMember(room, caller);
        verify(authorization, never()).requireDirectPeer(any(), any(), any());
        assertThatThrownBy(() -> result.content().clear()).isInstanceOf(UnsupportedOperationException.class);
    }
    @Test void timeoutIsMissedOnlyForRecipientAndUnansweredForCaller() {
        var time = now.minusSeconds(45);
        var state = CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(time.toEpochMilli()), caller, callee,
                CallState.Type.VOICE, time, UUID.randomUUID()).expire(now, UUID.randomUUID());
        own(state, caller, 25); own(state, callee, 25);
        assertThat(history.own(caller, "2026-10", null, 25).content().get(0).outcome()).isEqualTo(CallHistoryView.Outcome.UNANSWERED);
        var received = history.own(callee, "2026-10", null, 25).content().get(0);
        assertThat(received.outcome()).isEqualTo(CallHistoryView.Outcome.MISSED);
        assertThat(received.direction()).isEqualTo(CallHistoryView.Direction.INCOMING);
        assertThat(received.endedAt()).isEqualTo(state.deadline());
    }
    @Test void acceptedAndEndedProveConsentNotMediaAttendance() {
        var state = ringing().apply(callee, CallState.Action.ACCEPT, now, UUID.randomUUID());
        when(calls.find(room, state.callId())).thenReturn(state);
        var view = history.detail(caller, room, state.callId());
        assertThat(view.outcome()).isEqualTo(CallHistoryView.Outcome.ACCEPTED);
        assertThat(view.participants().get(0).acceptedAt()).isNull();
        assertThat(view.participants().get(1).acceptedAt()).isEqualTo(now);
        var ended = state.apply(caller, CallState.Action.END, now, UUID.randomUUID());
        when(calls.find(room, state.callId())).thenReturn(ended);
        assertThat(history.detail(caller, room, state.callId()).outcome()).isEqualTo(CallHistoryView.Outcome.ENDED);
        verifyNoInteractions(lifecycle);
    }
    @Test void archivedRoomAndRemovedPeerDoNotEraseCurrentActorsHistory() {
        var state = ended(); own(state, caller, 25);
        when(conversation.isDeleted()).thenReturn(true);
        assertThat(history.own(caller, "2026-10", null, 25).content()).hasSize(1);
        verify(store, never()).findConversationMember(room, callee);
        verify(authorization, never()).requireDirectPeer(any(), any(), any());
    }
    @Test void revokedActorIsFilteredFromOwnFeedAndDeniedFromRoomAndDetail() {
        var state = ended(); own(state, caller, 25);
        doThrow(new ForbiddenException("membership revoked")).when(authorization).requireMember(room, caller);
        assertThat(history.own(caller, "2026-10", null, 25).content()).isEmpty();
        assertThatThrownBy(() -> history.conversation(caller, room, "2026-10", null, 25)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> history.detail(caller, room, state.callId())).isInstanceOf(ForbiddenException.class);
        verify(index, never()).conversation(any(), any(), any(), anyInt());
    }
    @Test void membershipAloneDoesNotGrantAnotherCallsParticipantDetails() {
        var state = ended(); when(calls.find(room, state.callId())).thenReturn(state);
        UUID outsider = UUID.randomUUID(); own(state, outsider, 25);
        assertThat(history.own(outsider, "2026-10", null, 25).content()).isEmpty();
        assertThatThrownBy(() -> history.detail(outsider, room, state.callId())).isInstanceOf(ForbiddenException.class);
    }
    @Test void emptyRoomPageStillRequiresMembershipAndDm() {
        when(conversation.conversationType()).thenReturn("GROUP");
        assertThatThrownBy(() -> history.conversation(caller, room, "2026-10", null, 25)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(index);
        when(store.findConversation(room)).thenReturn(null);
        assertThatThrownBy(() -> history.conversation(caller, room, "2026-10", null, 25)).isInstanceOf(NotFoundException.class);
    }
    @Test void failedClaimHintYieldsEmptyPageButContinuesFromScannedKey() {
        var state = ended(); when(index.own(caller, month, null, 1)).thenReturn(List.of(key(state)));
        var page = history.own(caller, "2026-10", null, 1);
        assertThat(page.content()).isEmpty(); assertThat(page.hasNext()).isTrue();
        when(index.own(caller, month, key(state), 1)).thenReturn(List.of());
        var next = history.own(caller, "2026-10", page.nextCursor(), 1);
        assertThat(next.hasNext()).isFalse(); verify(index).own(caller, month, key(state), 1);
    }
    @Test void oldStartTupleDoesNotDuplicateTheCommittedAttempt() {
        var state = ended(); own(state, caller, 1);
        var stale = new CallHistoryRepository.Key(Uuids.startOf(now.minusMillis(1).toEpochMilli()), room, state.callId());
        when(index.own(caller, month, null, 1)).thenReturn(List.of(stale));
        var page = history.own(caller, "2026-10", null, 1);
        assertThat(page.content()).isEmpty(); assertThat(page.nextCursor()).isEqualTo(token(caller, null, "2026-10", stale));
        verifyNoInteractions(lifecycle);
    }
    @Test void overdueReadUsesFencedExpiryAndRereadsAuthority() {
        var time = now.minusSeconds(45);
        var state = CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(time.toEpochMilli()), caller, callee, CallState.Type.VOICE, time, UUID.randomUUID());
        var missed = state.expire(now, UUID.randomUUID());
        when(calls.find(room, state.callId())).thenReturn(state, missed);
        var slot = new CallRepository.Slot(state.revision(), state.callId()); when(calls.slot(room)).thenReturn(slot);
        assertThat(history.detail(callee, room, state.callId()).outcome()).isEqualTo(CallHistoryView.Outcome.MISSED);
        verify(lifecycle).expire(new CallRepository.Expiry(state.deadline(), room, state.callId(), state.revision(), slot.revision()));
    }
    @Test void sustainedExpiryContentionIsConflictNotFabricatedMissed() {
        var time = now.minusSeconds(45);
        var state = CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(time.toEpochMilli()), caller, callee, CallState.Type.VOICE, time, UUID.randomUUID());
        when(calls.find(room, state.callId())).thenReturn(state);
        when(calls.slot(room)).thenReturn(new CallRepository.Slot(state.revision(), state.callId()));
        assertThatThrownBy(() -> history.detail(callee, room, state.callId())).isInstanceOf(ConflictException.class);
        verify(lifecycle, times(4)).expire(any());
    }
    @Test void missingSlotForOverdueAuthorityIsAnError() {
        var time = now.minusSeconds(45);
        var state = CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(time.toEpochMilli()), caller, callee, CallState.Type.VOICE, time, UUID.randomUUID());
        when(calls.find(room, state.callId())).thenReturn(state);
        assertThatThrownBy(() -> history.detail(callee, room, state.callId())).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(lifecycle);
    }
    @Test void datastoreFailuresAreNotFilteredAsEmpty() {
        var state = ended(); own(state, caller, 25);
        when(calls.find(room, state.callId())).thenThrow(new IllegalStateException("authority unavailable"));
        assertThatThrownBy(() -> history.own(caller, "2026-10", null, 25)).isInstanceOf(IllegalStateException.class);
    }
    @Test void cursorCannotCrossActorRoomOrMonthAndMustContainCanonicalTimeuuid() {
        var key = key(ended());
        for (String bad : List.of(token(callee, null, "2026-10", key), token(caller, room, "2026-10", key),
                token(caller, null, "2026-09", key), token(caller, null, "2026-10", new CallHistoryRepository.Key(UUID.randomUUID(), room, key.callId())),
                token(caller, null, "2026-10", new CallHistoryRepository.Key(Uuids.endOf(now.toEpochMilli()), room, key.callId())),
                token(caller, null, "2026-10", new CallHistoryRepository.Key(key.startedOrder(), CallState.SLOT_ID, key.callId())),
                token(caller, null, "2026-10", new CallHistoryRepository.Key(key.startedOrder(), room, CallState.SLOT_ID)),
                " ".repeat(1025), "not-base64")) {
            assertThatThrownBy(() -> history.own(caller, "2026-10", bad, 25)).isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(index, calls, authorization, store);
    }
    @Test void invalidMonthLimitAndAnonymousRequestsFailBeforeRepository() {
        for (String bad : Arrays.asList(null, "2026-1", "2026-13", "1969-12", "2026-11", "9999-01", " 2026-10")) {
            assertThatThrownBy(() -> history.own(caller, bad, null, 25)).isInstanceOf(BadRequestException.class);
        }
        for (int limit : new int[]{0, -1, 51}) assertThatThrownBy(() -> history.own(caller, "2026-10", null, limit)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> history.own(null, "2026-10", null, 25)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(index, calls, authorization, store);
    }
    @Test void roomContinuationRetainsAllSameMillisecondKeysAndRechecksAccess() {
        var first = ended(); var second = ended();
        when(index.conversation(room, month, null, 1)).thenReturn(List.of(key(first)));
        when(index.conversation(room, month, key(first), 1)).thenReturn(List.of(key(second)));
        when(calls.find(room, first.callId())).thenReturn(first); when(calls.find(room, second.callId())).thenReturn(second);
        var page = history.conversation(caller, room, "2026-10", null, 1);
        var next = history.conversation(caller, room, "2026-10", page.nextCursor(), 1);
        assertThat(next.content()).extracting(CallHistoryView::callId).containsExactly(second.callId());
        verify(index).conversation(room, month, key(first), 1);
        doThrow(new ForbiddenException("revoked between pages")).when(authorization).requireMember(room, caller);
        assertThatThrownBy(() -> history.conversation(caller, room, "2026-10", next.nextCursor(), 1)).isInstanceOf(ForbiddenException.class);
    }
    @Test void sameCallUuidInTwoRoomsDoesNotMixIdentities() {
        var first = ended(); UUID other = UUID.randomUUID();
        var second = CallState.ringing(other, first.callId(), first.startedOrder(), caller, callee, first.callType(), first.createdAt(), UUID.randomUUID())
                .apply(caller, CallState.Action.END, now, UUID.randomUUID());
        when(store.findConversation(other)).thenReturn(conversation);
        when(index.own(caller, month, null, 25)).thenReturn(List.of(key(first), key(second)));
        when(calls.find(room, first.callId())).thenReturn(first); when(calls.find(other, first.callId())).thenReturn(second);
        assertThat(history.own(caller, "2026-10", null, 25).content()).extracting(CallHistoryView::conversationId).containsExactly(room, other);
        verifyNoInteractions(lifecycle);
    }
    @Test void slotReplacementRaceRereadsTerminalHistoryWithoutExpiringAnotherCall() {
        var time = now.minusSeconds(45);
        var state = CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(time.toEpochMilli()), caller, callee, CallState.Type.VOICE, time, UUID.randomUUID());
        var ended = state.expire(now, UUID.randomUUID());
        when(calls.find(room, state.callId())).thenReturn(state, ended);
        when(calls.slot(room)).thenReturn(new CallRepository.Slot(UUID.randomUUID(), UUID.randomUUID()));
        assertThat(history.detail(caller, room, state.callId()).outcome()).isEqualTo(CallHistoryView.Outcome.UNANSWERED);
        verifyNoInteractions(lifecycle);
    }
    @Test void actualMembershipHelperAllowsDepartedPeerButRejectsRemovedActor() {
        var state = ended(); when(calls.find(room, state.callId())).thenReturn(state);
        var member = mock(com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember.class);
        when(store.findConversationMember(room, caller)).thenReturn(member);
        var realAuthorization = new ConversationAuthorizationService(store,
                mock(com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository.class));
        var service = new CallHistoryService(index, calls, realAuthorization, store, lifecycle, Clock.fixed(now, ZoneOffset.UTC));
        assertThat(service.detail(caller, room, state.callId()).callId()).isEqualTo(state.callId());
        verify(store, never()).findConversationMember(room, callee);
        when(store.findConversationMember(room, caller)).thenReturn(null);
        assertThatThrownBy(() -> service.detail(caller, room, state.callId())).isInstanceOf(ForbiddenException.class);
    }
    @Test void missingDetailAndReservedIdsNeverReturnFakeHistory() {
        assertThatThrownBy(() -> history.detail(caller, room, UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        clearInvocations(index, calls, authorization, store);
        assertThatThrownBy(() -> history.detail(caller, room, CallState.SLOT_ID)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> history.conversation(caller, CallState.SLOT_ID, "2026-10", null, 25)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(index, calls, authorization, store);
    }
    @Test void clockFailureIsNotMisreportedAsAnInvalidClientMonth() {
        var failedClock = mock(Clock.class); when(failedClock.instant()).thenThrow(new IllegalStateException("clock unavailable"));
        var service = new CallHistoryService(index, calls, authorization, store, lifecycle, failedClock);
        assertThatThrownBy(() -> service.own(caller, "2026-10", null, 25)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(index, calls, authorization, store);
    }
}
