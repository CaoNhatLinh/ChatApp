package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.common.exception.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CallLifecycleServiceTest {
    final UUID room = UUID.randomUUID(), caller = UUID.randomUUID(), callee = UUID.randomUUID(), callId = UUID.randomUUID();
    final Instant start = Instant.parse("2026-10-20T09:00:00Z");
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    final UserRepository users = mock(UserRepository.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final CanonicalConversation conversation = mock(CanonicalConversation.class);
    final MemoryCalls calls = new MemoryCalls();
    CallLifecycleService service(Instant instant) { return new CallLifecycleService(calls, authorization, store, friendships, users, Clock.fixed(instant, ZoneOffset.UTC)); }
    CallLifecycleServiceTest() {
        when(store.findConversation(room)).thenReturn(conversation);
        var active = mock(CanonicalUser.class);
        when(active.accountStatus()).thenReturn("ACTIVE");
        when(users.findById(caller)).thenReturn(active);
        when(users.findById(callee)).thenReturn(active);
    }
    CallState startCall() { return service(start).start(caller, room, callId, callee, CallState.Type.VIDEO); }

    @Test void exactStartReplaySurvivesServiceRecreationWithoutReallocating() {
        var first = startCall();
        assertThat(service(start.plusSeconds(2)).start(caller, room, callId, callee, CallState.Type.VIDEO)).isEqualTo(first);
        assertThat(calls.states).hasSize(1);
        assertThat(first.startedOrder().version()).isEqualTo(1);
        verify(authorization, times(2)).requirePermission(room, caller, ConversationPermission.CALL_START);
    }
    @Test void changedStartIdentityConflictsAndTerminalIdNeverReopens() {
        startCall();
        assertThatThrownBy(() -> service(start).start(caller, room, callId, callee, CallState.Type.VOICE)).isInstanceOf(ConflictException.class);
        var ended = service(start.plusSeconds(2)).change(caller, room, callId, CallState.Action.END);
        assertThat(ended.status()).isEqualTo(CallState.Status.CANCELLED);
        assertThat(calls.slot(room).activeCallId()).isNull();
        assertThat(service(start.plusSeconds(3)).start(caller, room, callId, callee, CallState.Type.VIDEO)).isEqualTo(ended);
    }
    @Test void archivedBlockedAndForbiddenStartsDoNotAllocate() {
        when(conversation.isDeleted()).thenReturn(true);
        assertThatThrownBy(this::startCall).isInstanceOf(NotFoundException.class);
        when(conversation.isDeleted()).thenReturn(false);
        when(friendships.isBlocked(caller, callee)).thenReturn(true);
        assertThatThrownBy(this::startCall).isInstanceOf(ForbiddenException.class);
        when(friendships.isBlocked(caller, callee)).thenReturn(false);
        doThrow(new ForbiddenException("denied")).when(authorization).requirePermission(room, caller, ConversationPermission.CALL_START);
        assertThatThrownBy(this::startCall).isInstanceOf(ForbiddenException.class);
        assertThat(calls.slot(room)).isNull(); assertThat(calls.states).isEmpty();
    }
    @Test void onlyOneConcurrentStartWinsInTheAuthorityModel() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        var gate = new CountDownLatch(1);
        try {
            Callable<Boolean> launch = () -> { gate.await(); try {
                service(start).start(caller, room, UUID.randomUUID(), callee, CallState.Type.VOICE); return true;
            } catch (ConflictException busy) { return false; } };
            var a = pool.submit(launch); var b = pool.submit(launch); gate.countDown();
            assertThat(List.of(a.get(5, TimeUnit.SECONDS), b.get(5, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
            assertThat(calls.states).hasSize(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void busyCallRejectsAnotherButOverdueCallIsExpiredBeforeTakeover() {
        var old = startCall();
        assertThatThrownBy(() -> service(start.plusSeconds(10)).start(callee, room, UUID.randomUUID(), caller, CallState.Type.VOICE)).isInstanceOf(ConflictException.class);
        UUID nextId = UUID.randomUUID();
        var next = service(start.plusSeconds(46)).start(callee, room, nextId, caller, CallState.Type.VOICE);
        assertThat(calls.find(room, old.callId()).status()).isEqualTo(CallState.Status.MISSED);
        assertThat(calls.slot(room).activeCallId()).isEqualTo(next.callId());
    }
    @Test void lateAcceptReturnsMissedAndCannotResurrectAfterRestart() {
        startCall();
        var late = service(start.plusSeconds(45)).change(callee, room, callId, CallState.Action.ACCEPT);
        assertThat(late.status()).isEqualTo(CallState.Status.MISSED);
        assertThat(service(start.plusSeconds(90)).get(callee, room, callId)).isEqualTo(late);
    }
    @Test void authorityReadAndMutationRequireCurrentMembershipAndParticipant() {
        startCall();
        assertThatThrownBy(() -> service(start).get(UUID.randomUUID(), room, callId)).isInstanceOf(ForbiddenException.class);
        doThrow(new ForbiddenException("removed")).when(authorization).requireDirectPeer(room, callee, caller);
        assertThatThrownBy(() -> service(start).change(callee, room, callId, CallState.Action.ACCEPT)).isInstanceOf(ForbiddenException.class);
        assertThat(calls.find(room, callId).status()).isEqualTo(CallState.Status.RINGING);
    }
    @Test void revokedBlockPreventsAcceptButAllowsParticipantToEnd() {
        startCall(); when(friendships.isBlocked(callee, caller)).thenReturn(true);
        assertThatThrownBy(() -> service(start.plusSeconds(1)).change(callee, room, callId, CallState.Action.ACCEPT)).isInstanceOf(ForbiddenException.class);
        assertThat(service(start.plusSeconds(2)).change(callee, room, callId, CallState.Action.END).status()).isEqualTo(CallState.Status.DECLINED);
    }
    @Test void PeerBlockIsCheckedAgainstAuthorityInBothDirections() {
        when(friendships.isBlocked(callee, caller)).thenReturn(true);
        assertThatThrownBy(this::startCall).isInstanceOf(ForbiddenException.class);
        when(friendships.isBlocked(callee, caller)).thenReturn(false); startCall();
        when(friendships.isBlocked(caller, callee)).thenReturn(true);
        assertThatThrownBy(() -> service(start.plusSeconds(1)).change(callee, room, callId, CallState.Action.ACCEPT)).isInstanceOf(ForbiddenException.class);
    }
    @Test void staleExpiryCannotCloseNewerHeartbeatOrReplacementCall() {
        var call = startCall();
        var before = calls.slot(room);
        var candidate = new CallRepository.Expiry(call.deadline(), room, callId, call.revision(), UUID.randomUUID());
        var accepted = service(start.plusSeconds(1)).change(callee, room, callId, CallState.Action.ACCEPT);
        assertThat(service(start.plusSeconds(46)).expire(candidate)).isTrue();
        assertThat(calls.find(room, callId)).isEqualTo(accepted);
        assertThat(calls.slot(room)).isNotEqualTo(before);
    }
    @Test void pendingPrewriteMustRemainUntilItsExpectedSlotIsFenced() {
        calls.initialize(room); UUID expected = calls.slot(room).revision();
        var pending = new CallRepository.Expiry(start, room, callId, UUID.randomUUID(), expected);
        assertThat(service(start).expire(pending)).isFalse();
        startCall(); // Changes the slot revision, so that paused CAS can no longer win.
        assertThat(service(start).expire(pending)).isTrue();
    }
    @Test void matchingExpiryIsServerFencedAndDoesNotRequireContinuingMembership() {
        var call = startCall();
        var expiry = new CallRepository.Expiry(call.deadline(), room, callId, call.revision(), UUID.randomUUID());
        assertThat(service(start.plusSeconds(44)).expire(expiry)).isFalse();
        clearInvocations(authorization);
        assertThat(service(start.plusSeconds(50)).expire(expiry)).isTrue();
        assertThat(calls.find(room, callId).status()).isEqualTo(CallState.Status.MISSED);
        assertThat(calls.slot(room).activeCallId()).isNull(); verifyNoInteractions(authorization);
    }
    @Test void repeatedCasLossIsBoundedInsteadOfLooping() {
        calls.reject = true;
        assertThatThrownBy(this::startCall).isInstanceOf(ConflictException.class);
        assertThat(calls.claims).isEqualTo(4); assertThat(calls.states).isEmpty();
    }
    @Test void signalRequiresAcceptedStateAndExactPeer() {
        startCall();
        assertThatThrownBy(() -> service(start).authorizeSignal(caller, room, callId, callee)).isInstanceOf(ConflictException.class);
        var accepted = service(start.plusSeconds(1)).change(callee, room, callId, CallState.Action.ACCEPT);
        assertThat(service(start.plusSeconds(2)).authorizeSignal(caller, room, callId, callee)).isEqualTo(accepted);
        assertThatThrownBy(() -> service(start.plusSeconds(2)).authorizeSignal(caller, room, callId, UUID.randomUUID())).isInstanceOf(ForbiddenException.class);
    }
    @Test void signalRechecksArchiveAndBothAuthoritativeBlockDirections() {
        startCall(); service(start.plusSeconds(1)).change(callee, room, callId, CallState.Action.ACCEPT);
        when(conversation.isDeleted()).thenReturn(true);
        assertThatThrownBy(() -> service(start.plusSeconds(2)).authorizeSignal(caller, room, callId, callee)).isInstanceOf(NotFoundException.class);
        when(conversation.isDeleted()).thenReturn(false);
        when(friendships.isBlocked(callee, caller)).thenReturn(true);
        assertThatThrownBy(() -> service(start.plusSeconds(2)).authorizeSignal(caller, room, callId, callee)).isInstanceOf(ForbiddenException.class);
    }
    @Test void realLifecycleConvergesAfterCommittedStartLosesItsBroadcast() {
        var messaging = mock(SimpMessagingTemplate.class);
        doThrow(new IllegalStateException("broker unavailable")).doNothing().when(messaging).convertAndSend(anyString(), any(Object.class), anyMap());
        var signaling = new CallSignalingService(service(start), messaging, new CallStatePublisher(calls, messaging));
        var command = new CallSignalingService.Command(UUID.randomUUID(), room, callId, "VIDEO", callee, null);
        var lost = signaling.execute(caller, CallSignalingService.Action.START, command);
        assertThat(lost.errorCode()).isEqualTo("UNAVAILABLE");
        var persisted = calls.find(room, callId);
        var retried = signaling.execute(caller, CallSignalingService.Action.START, command);
        assertThat(retried.accepted()).isTrue();
        assertThat(retried.state().revision()).isEqualTo(persisted.revision());
        assertThat(retried.state().version()).isEqualTo(1);
        assertThat(calls.states).hasSize(1); assertThat(calls.claims).isEqualTo(1);
    }
    @Test void heartbeatCannotKeepAnArchivedOrNewlyBlockedCallAlive() {
        startCall(); service(start.plusSeconds(1)).change(callee, room, callId, CallState.Action.ACCEPT);
        when(friendships.isBlocked(callee, caller)).thenReturn(true);
        assertThatThrownBy(() -> service(start.plusSeconds(2)).change(caller, room, callId, CallState.Action.HEARTBEAT)).isInstanceOf(ForbiddenException.class);
        when(friendships.isBlocked(callee, caller)).thenReturn(false);
        when(conversation.isDeleted()).thenReturn(true);
        assertThatThrownBy(() -> service(start.plusSeconds(3)).change(caller, room, callId, CallState.Action.HEARTBEAT)).isInstanceOf(NotFoundException.class);
    }

    /** Atomic test model only; not proof of Cassandra conditional-batch behavior. */
    static class MemoryCalls implements CallRepository {
        final Map<UUID, Slot> slots = new HashMap<>();
        final Map<UUID, CallState> states = new HashMap<>();
        final Map<UUID, Long> receipts = new HashMap<>();
        boolean reject; int claims;
        public synchronized void initialize(UUID room) { slots.putIfAbsent(room, new Slot(UUID.randomUUID(), null)); }
        public synchronized Slot slot(UUID room) { return slots.get(room); }
        public synchronized CallState find(UUID room, UUID id) { var state = states.get(id); return state != null && state.conversationId().equals(room) ? state : null; }
        public synchronized boolean claim(Slot before, CallState call) {
            claims++;
            if (reject || !before.equals(slots.get(call.conversationId())) || before.activeCallId() != null || states.containsKey(call.callId())) return false;
            slots.put(call.conversationId(), new Slot(call.revision(), call.callId())); states.put(call.callId(), call); return true;
        }
        public synchronized boolean change(Slot slot, CallState before, CallState after) {
            if (reject || !slot.equals(slots.get(before.conversationId())) || !before.callId().equals(slot.activeCallId()) || !before.equals(states.get(before.callId()))) return false;
            slots.put(before.conversationId(), new Slot(after.revision(), after.terminal() ? null : after.callId())); states.put(after.callId(), after); return true;
        }
        public synchronized Publication publication(UUID room, UUID id) {
            var state = find(room, id); return state == null ? null : new Publication(state, receipts.getOrDefault(id, 0L));
        }
        public synchronized boolean markPublished(CallState state, long version) {
            if (!state.equals(find(state.conversationId(), state.callId())) || receipts.getOrDefault(state.callId(), 0L) != version) return false;
            receipts.put(state.callId(), state.version()); return true;
        }
        public synchronized boolean fenceSlot(UUID room, Slot expected, UUID revision) {
            if (!expected.equals(slots.get(room))) return false;
            slots.put(room, new Slot(revision, expected.activeCallId())); return true;
        }
    }
}
