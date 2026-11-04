package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.common.exception.*;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CallActiveQueryTest {
    final UUID room = UUID.randomUUID(), caller = UUID.randomUUID(), callee = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    final CallLifecycleServiceTest.MemoryCalls calls = spy(new CallLifecycleServiceTest.MemoryCalls());
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final CanonicalConversation conversation = mock(CanonicalConversation.class);
    CallActiveQueryTest() {
        when(store.findConversation(room)).thenReturn(conversation); when(conversation.conversationType()).thenReturn("DM");
        var active = mock(CanonicalUser.class);
        when(active.accountStatus()).thenReturn("ACTIVE");
        when(users.findById(caller)).thenReturn(active); when(users.findById(callee)).thenReturn(active);
    }
    CallLifecycleService service(Instant time) { return new CallLifecycleService(calls, authorization, store, friendships, users, Clock.fixed(time, ZoneOffset.UTC)); }
    CallState start() { return service(now).start(caller, room, UUID.randomUUID(), callee, CallState.Type.VOICE); }

    @Test void emptyLookupDoesNotAllocateASlotOrInspectHistory() {
        assertThat(service(now).active(caller, room)).isNull();
        verify(authorization).requireMember(room, caller);
        verify(calls, never()).initialize(any()); verify(calls, never()).find(any(), any());
    }
    @Test void currentRingingAndAcceptedAuthorityCanBeDiscoveredWithoutCallId() {
        var ringing = start();
        assertThat(service(now.plusSeconds(1)).active(callee, room)).isEqualTo(ringing);
        var accepted = service(now.plusSeconds(2)).change(callee, room, ringing.callId(), CallState.Action.ACCEPT);
        assertThat(service(now.plusSeconds(3)).active(caller, room)).isEqualTo(accepted);
    }
    @Test void membershipIsRequiredEvenWhenNoSlotExists() {
        doThrow(new ForbiddenException("not member")).when(authorization).requireMember(room, caller);
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(calls);
    }
    @Test void archivedCommunityAndMissingRoomCannotExposeCalls() {
        when(conversation.isDeleted()).thenReturn(true);
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(NotFoundException.class);
        when(conversation.isDeleted()).thenReturn(false); when(conversation.conversationType()).thenReturn("COMMUNITY");
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(BadRequestException.class);
        when(store.findConversation(room)).thenReturn(null);
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(calls);
    }
    @Test void currentBlocksAndExactParticipantsAreRechecked() {
        start(); when(friendships.isBlocked(callee, caller)).thenReturn(true);
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(ForbiddenException.class);
        when(friendships.isBlocked(callee, caller)).thenReturn(false); when(friendships.isBlocked(caller, callee)).thenReturn(true);
        assertThatThrownBy(() -> service(now).active(callee, room)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service(now).active(UUID.randomUUID(), room)).isInstanceOf(ForbiddenException.class);
    }
    @Test void deadlineLookupExpiresAuthorityRatherThanReturningFalseIncomingCall() {
        var ringing = start();
        assertThat(service(ringing.deadline()).active(callee, room)).isNull();
        var ended = calls.find(room, ringing.callId());
        assertThat(ended.status()).isEqualTo(CallState.Status.MISSED);
        assertThat(ended.endedAt()).isEqualTo(ringing.deadline());
        assertThat(calls.slot(room).activeCallId()).isNull();
    }
    @Test void missingSnapshotIsUnavailableNotAnEmptyResult() {
        var ringing = start(); calls.states.remove(ringing.callId());
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(IllegalStateException.class);
    }
    @Test void replacementBetweenReadsIsRetriedInsteadOfReturningOldCall() {
        var first = start(); var original = calls.slot(room);
        var next = CallState.ringing(room, UUID.randomUUID(), UUID.randomUUID(), caller, callee, CallState.Type.VIDEO, now.plusSeconds(1), UUID.randomUUID());
        calls.states.put(next.callId(), next);
        var replacement = new CallRepository.Slot(next.revision(), next.callId());
        doReturn(original, replacement, replacement, replacement).when(calls).slot(room);
        assertThat(service(now.plusSeconds(2)).active(caller, room)).isEqualTo(next);
        assertThat(first.callId()).isNotEqualTo(next.callId());
    }
    @Test void sustainedContentionAndExpiryCasLossAreNotReportedAsEmpty() {
        var call = start(); calls.reject = true;
        assertThatThrownBy(() -> service(call.deadline()).active(caller, room)).isInstanceOf(ConflictException.class);
        assertThat(calls.find(room, call.callId()).status()).isEqualTo(CallState.Status.RINGING);
        doAnswer(ignored -> new CallRepository.Slot(UUID.randomUUID(), call.callId())).when(calls).slot(room);
        assertThatThrownBy(() -> service(now).active(caller, room)).isInstanceOf(ConflictException.class);
    }
    @Test void outboundStateRequiresExactRevisionButAcceptedSignalsSurviveHeartbeatRevision() {
        var ringing = start();
        var state = new CallDelivery(room, ringing.callId(), ringing.revision(), CallDelivery.Kind.STATE);
        service(now).requireDelivery(callee, state);
        var accepted = service(now.plusSeconds(1)).change(callee, room, ringing.callId(), CallState.Action.ACCEPT);
        assertThatThrownBy(() -> service(now.plusSeconds(2)).requireDelivery(callee, state)).isInstanceOf(ConflictException.class);
        var signal = new CallDelivery(room, ringing.callId(), accepted.revision(), CallDelivery.Kind.SIGNAL);
        service(now.plusSeconds(3)).change(caller, room, ringing.callId(), CallState.Action.HEARTBEAT);
        service(now.plusSeconds(4)).requireDelivery(callee, signal);
        var ended = service(now.plusSeconds(5)).change(caller, room, ringing.callId(), CallState.Action.END);
        assertThatThrownBy(() -> service(now.plusSeconds(6)).requireDelivery(callee, signal)).isInstanceOf(ConflictException.class);
        service(now.plusSeconds(6)).requireDelivery(callee, new CallDelivery(room, ended.callId(), ended.revision(), CallDelivery.Kind.STATE));
    }
    @Test void outboundCallDeliveryRechecksParticipantsDeadlineAndCurrentBlocks() {
        var ringing = start(); var delivery = new CallDelivery(room, ringing.callId(), ringing.revision(), CallDelivery.Kind.STATE);
        assertThatThrownBy(() -> service(now).requireDelivery(UUID.randomUUID(), delivery)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service(ringing.deadline()).requireDelivery(callee, delivery)).isInstanceOf(ConflictException.class);
        when(friendships.isBlocked(callee, caller)).thenReturn(true);
        assertThatThrownBy(() -> service(now).requireDelivery(caller, delivery)).isInstanceOf(ForbiddenException.class);
        when(friendships.isBlocked(callee, caller)).thenReturn(false); when(conversation.isDeleted()).thenReturn(true);
        assertThatThrownBy(() -> service(now).requireDelivery(callee, delivery)).isInstanceOf(NotFoundException.class);
    }
    @Test void outboundCallDeliveryDoesNotTrustMembershipFromOriginalSubscription() {
        var ringing = start(); var delivery = CallDelivery.of(ringing, CallDelivery.Kind.STATE);
        doThrow(new ForbiddenException("membership revoked")).when(authorization).requireDirectPeer(room, caller, callee);
        assertThatThrownBy(() -> service(now).requireDelivery(caller, delivery)).isInstanceOf(ForbiddenException.class);
    }
}
