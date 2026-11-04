package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import java.util.UUID;
import java.util.List;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CallContactEligibilityTest {
    final CallLifecycleServiceTest fixture = new CallLifecycleServiceTest();

    static Stream<Arguments> unavailableAccounts() {
        return Stream.of("caller", "callee").flatMap(role -> Stream.of("SUSPENDED", "BANNED", "DELETED", "UNKNOWN", "")
                .map(status -> Arguments.of(role, status)));
    }

    private UUID participant(String role) { return "caller".equals(role) ? fixture.caller : fixture.callee; }
    private void account(UUID actor, String status) {
        var user = mock(CanonicalUser.class);
        when(user.accountStatus()).thenReturn(status);
        when(fixture.users.findById(actor)).thenReturn(user);
    }

    @ParameterizedTest @MethodSource("unavailableAccounts")
    void unavailableParticipantCannotAllocateNewCall(String role, String status) {
        account(participant(role), status);
        assertThatThrownBy(fixture::startCall).isInstanceOf(ForbiddenException.class);
        assertThat(fixture.calls.states).isEmpty();
        assertThat(fixture.calls.slot(fixture.room)).isNull();
    }

    @ParameterizedTest @ValueSource(strings = {"caller", "callee"})
    void missingAccountOrNullStatusCannotAllocateNewCall(String role) {
        when(fixture.users.findById(participant(role))).thenReturn(null);
        assertThatThrownBy(fixture::startCall).isInstanceOf(ForbiddenException.class);
        account(participant(role), null);
        assertThatThrownBy(fixture::startCall).isInstanceOf(ForbiddenException.class);
        assertThat(fixture.calls.states).isEmpty();
        assertThat(fixture.calls.slot(fixture.room)).isNull();
    }

    @Test void activeAccountsAreReadFromCanonicalRepositoryAndCanStart() {
        assertThat(fixture.startCall().status()).isEqualTo(CallState.Status.RINGING);
        verify(fixture.users).findById(fixture.caller);
        verify(fixture.users).findById(fixture.callee);
    }

    @ParameterizedTest @ValueSource(strings = {"caller", "callee"})
    void revocationAfterRingingPreventsConsentAndIncomingDiscovery(String role) {
        var ringing = fixture.startCall();
        account(participant(role), "SUSPENDED");
        assertThatThrownBy(() -> fixture.service(fixture.start.plusSeconds(1))
                .change(fixture.callee, fixture.room, fixture.callId, CallState.Action.ACCEPT)).isInstanceOf(ForbiddenException.class);
        var index = mock(IncomingCallRepository.class);
        when(index.page(fixture.callee, fixture.start, null, 25)).thenReturn(List.of(
                new IncomingCallRepository.Key(ringing.deadline(), fixture.room, fixture.callId)));
        var incoming = new IncomingCallService(index, fixture.service(fixture.start), Clock.fixed(fixture.start, ZoneOffset.UTC));
        assertThat(incoming.list(fixture.callee, null, 25).content()).isEmpty();
        assertThat(fixture.calls.find(fixture.room, fixture.callId)).isEqualTo(ringing);
    }

    @ParameterizedTest @ValueSource(strings = {"caller", "callee"})
    void revocationAfterConsentStopsActiveReadsHeartbeatSignalAndDelivery(String role) {
        fixture.startCall();
        var accepted = fixture.service(fixture.start.plusSeconds(1)).change(fixture.callee, fixture.room, fixture.callId, CallState.Action.ACCEPT);
        account(participant(role), "BANNED");
        var service = fixture.service(fixture.start.plusSeconds(2));
        when(fixture.conversation.conversationType()).thenReturn("DM");
        for (UUID actor : List.of(fixture.caller, fixture.callee)) {
            UUID peer = accepted.peerOf(actor);
            assertThatThrownBy(() -> service.active(actor, fixture.room)).isInstanceOf(ForbiddenException.class);
            assertThatThrownBy(() -> service.change(actor, fixture.room, fixture.callId, CallState.Action.HEARTBEAT)).isInstanceOf(ForbiddenException.class);
            assertThatThrownBy(() -> service.authorizeSignal(actor, fixture.room, fixture.callId, peer)).isInstanceOf(ForbiddenException.class);
            for (var kind : CallDelivery.Kind.values()) {
                assertThatThrownBy(() -> service.requireDelivery(actor, CallDelivery.of(accepted, kind))).isInstanceOf(ForbiddenException.class);
            }
        }
        assertThat(fixture.calls.find(fixture.room, fixture.callId)).isEqualTo(accepted);
    }

    @Test void peerRemovalDoesNotPreventParticipantCleanupOrHistoricalExpiry() {
        var ringing = fixture.startCall();
        when(fixture.users.findById(fixture.callee)).thenReturn(null);
        when(fixture.conversation.conversationType()).thenReturn("DM");
        clearInvocations(fixture.users);
        var index = mock(CallHistoryRepository.class);
        var history = new CallHistoryService(index, fixture.calls, fixture.authorization, fixture.store,
                fixture.service(ringing.deadline()), Clock.fixed(ringing.deadline(), ZoneOffset.UTC));
        var view = history.detail(fixture.caller, fixture.room, fixture.callId);
        assertThat(view.outcome()).isEqualTo(CallHistoryView.Outcome.UNANSWERED);
        assertThat(view.participants()).hasSize(2);
        verifyNoInteractions(fixture.users);
    }

    @ParameterizedTest @ValueSource(strings = {"END", "LEAVE", "FAIL"})
    void missingPeerDoesNotBlockExplicitCleanup(String action) {
        fixture.startCall();
        when(fixture.users.findById(fixture.callee)).thenReturn(null);
        clearInvocations(fixture.users);
        var ended = fixture.service(fixture.start.plusSeconds(2)).change(fixture.caller, fixture.room, fixture.callId, CallState.Action.valueOf(action));
        assertThat(ended.terminal()).isTrue();
        assertThat(fixture.calls.slot(fixture.room).activeCallId()).isNull();
        verifyNoInteractions(fixture.users);
    }

    @Test void accountStoreFailureIsUnavailableNotAnAuthorizationDecisionOrNewCall() {
        when(fixture.users.findById(fixture.callee)).thenThrow(new IllegalStateException("private store detail"));
        var messaging = mock(org.springframework.messaging.simp.SimpMessagingTemplate.class);
        var signaling = new CallSignalingService(fixture.service(fixture.start), messaging, new CallStatePublisher(fixture.calls, messaging));
        var result = signaling.execute(fixture.caller, CallSignalingService.Action.START,
                new CallSignalingService.Command(UUID.randomUUID(), fixture.room, fixture.callId, "VOICE", fixture.callee, null));
        assertThat(result.accepted()).isFalse();
        assertThat(result.errorCode()).isEqualTo("UNAVAILABLE");
        assertThat(result.state()).isNull();
        assertThat(fixture.calls.slot(fixture.room)).isNull();
        verifyNoInteractions(messaging);
    }
}
