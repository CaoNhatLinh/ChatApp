package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.call.CallLifecycleService;
import com.chatapp.chat_service.canonical.call.CallDelivery;
import com.chatapp.chat_service.canonical.call.CallDeliveryHeaders;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.security.core.AppUserPrincipal;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StompAuthenticationInterceptorTest {
    private final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    private final JwtTokenProvider tokens = mock(JwtTokenProvider.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CallLifecycleService calls = mock(CallLifecycleService.class);
    private final StompAuthenticationInterceptor interceptor = new StompAuthenticationInterceptor(
            tokens, authorization, mock(AppAuthorizationService.class), users, calls);
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void activeAccount() {
        when(tokens.isTokenValid("token")).thenReturn(true);
        when(tokens.extractUserId("token")).thenReturn(userId);
        when(tokens.extractUsername("token")).thenReturn("tester");
        when(users.findById(userId)).thenReturn(new CanonicalUser(userId, "tester", "tester",
                null, null, null, null, null, null, null, "ACTIVE", null, null, null));
    }

    @Test
    void dropsConversationDeliveryAfterMembershipRevoked() {
        connect();
        UUID roomId = UUID.randomUUID();
        Message<byte[]> delivery = delivery("/topic/conversation/" + roomId);
        var outbound = new StompOutboundAuthorizationInterceptor(interceptor);
        assertNotNull(outbound.beforeHandle(delivery, null, null));
        doThrow(new IllegalArgumentException("not member")).when(authorization).requireMember(roomId, userId);
        assertNull(outbound.beforeHandle(delivery, null, null));
    }

    @Test
    void dropsPrivateDeliveryAfterSuspensionOrTokenExpiry() {
        connect();
        Message<byte[]> delivery = delivery("/queue/notifications-user-session");
        assertTrue(interceptor.canDeliver(delivery));
        when(users.findById(userId)).thenReturn(null);
        assertFalse(interceptor.canDeliver(delivery));
        activeAccount();
        when(tokens.isTokenValid("token")).thenReturn(false);
        assertFalse(interceptor.canDeliver(delivery));
    }

    private void connect() {
        var headers = StompHeaderAccessor.create(StompCommand.CONNECT);
        headers.setSessionId("session");
        headers.setNativeHeader("Authorization", "Bearer token");
        headers.setLeaveMutable(true);
        Message<byte[]> connect = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
        interceptor.preSend(connect, null);
        assertEquals(userId.toString(), SimpMessageHeaderAccessor.getUser(connect.getHeaders()).getName());
    }

    private Message<byte[]> delivery(String destination) {
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId("session");
        headers.setDestination(destination);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    @Test
    void rejectsBrokerSendAndUnknownApplicationCommands() {
        for (String destination : new String[]{"/topic/conversation/" + UUID.randomUUID(),
                "/queue/notifications", "/user/queue/notifications", "/app/unknown"}) {
            assertThrows(IllegalArgumentException.class,
                    () -> interceptor.preSend(frame(StompCommand.SEND, destination, true), null));
        }
    }

    @Test
    void allowsOnlyAuthenticatedCanonicalCommands() {
        assertNotNull(interceptor.preSend(frame(StompCommand.SEND, "/app/typing", true), null));
        assertThrows(IllegalArgumentException.class,
                () -> interceptor.preSend(frame(StompCommand.SEND, "/app/typing", false), null));
    }

    @Test
    void callControlAndPrivateResultsRequireAnActiveAuthenticatedSession() {
        for (String action : new String[]{"start", "join", "leave", "end", "fail", "heartbeat", "sync", "signal"}) {
            assertNotNull(interceptor.preSend(frame(StompCommand.SEND, "/app/call." + action, true), null));
            assertThrows(IllegalArgumentException.class, () -> interceptor.preSend(frame(StompCommand.SEND, "/app/call." + action, false), null));
        }
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/call-results", true), null));
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/calls", true), null));
        assertThrows(IllegalArgumentException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/other/queue/calls", true), null));
        assertThrows(IllegalArgumentException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/queue/calls", true), null));
        assertThrows(IllegalArgumentException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/queue/call-results", true), null));
        assertThrows(IllegalArgumentException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/other/queue/call-results", true), null));
        when(users.findById(userId)).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> interceptor.preSend(frame(StompCommand.SEND, "/app/call.sync", true), null));
    }
    @Test void callDeliveryRequiresTrustedScopeAndRevalidatesCurrentAuthority() {
        connect();
        var scope = new CallDelivery(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), CallDelivery.Kind.STATE);
        assertFalse(interceptor.canDeliver(delivery("/queue/calls-user-session")));
        var message = callDelivery("/queue/calls-user-session", scope);
        assertTrue(interceptor.canDeliver(message)); verify(calls).requireDelivery(userId, scope);
        doThrow(new IllegalStateException("storage unavailable")).when(calls).requireDelivery(userId, scope);
        assertFalse(interceptor.canDeliver(message));
    }
    @Test void privateCallQueueCannotDeliverSignalsAndRoomScopeCannotBeForged() {
        connect();
        var scope = new CallDelivery(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), CallDelivery.Kind.SIGNAL);
        assertFalse(interceptor.canDeliver(callDelivery("/queue/calls-user-session", scope)));
        assertFalse(interceptor.canDeliver(callDelivery("/topic/conversation/" + UUID.randomUUID() + "/calls", scope)));
        verifyNoInteractions(calls);
        assertTrue(interceptor.canDeliver(callDelivery("/topic/conversation/" + scope.conversationId() + "/calls", scope)));
        verify(calls).requireDelivery(userId, scope);
    }
    @Test void nativeClientHeadersCannotStandInForServerDeliveryMetadata() {
        connect();
        var headers = StompHeaderAccessor.create(StompCommand.MESSAGE);
        headers.setSessionId("session"); headers.setDestination("/queue/calls-user-session");
        headers.setNativeHeader("noiCallRoom", UUID.randomUUID().toString());
        headers.setNativeHeader("noiCallId", UUID.randomUUID().toString());
        headers.setNativeHeader("noiCallRevision", UUID.randomUUID().toString());
        headers.setNativeHeader("noiCallKind", "STATE");
        assertFalse(interceptor.canDeliver(MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders())));
        verifyNoInteractions(calls);
    }
    private Message<byte[]> callDelivery(String destination, CallDelivery delivery) {
        var message = MessageBuilder.createMessage(new byte[0], CallDeliveryHeaders.of(delivery));
        var headers = SimpMessageHeaderAccessor.wrap(message);
        headers.setSessionId("session"); headers.setDestination(destination);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    @Test
    void rejectsWildcardAndRawQueueSubscriptions() {
        for (String destination : new String[]{"/topic/**", "/queue/notifications", "/user/**",
                "/topic/conversation/" + UUID.randomUUID() + "/unknown"}) {
            assertThrows(IllegalArgumentException.class,
                    () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, destination, true), null));
        }
    }

    @Test
    void checksMembershipForCanonicalConversationTopics() {
        UUID roomId = UUID.randomUUID();
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE,
                "/topic/conversation/" + roomId + "/polls", true), null));
        verify(authorization).requireMember(roomId, userId);
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/notifications", true), null));
    }

    private Message<byte[]> frame(StompCommand command, String destination, boolean authenticated) {
        var headers = StompHeaderAccessor.create(command);
        headers.setDestination(destination);
        if (authenticated) {
            var principal = new AppUserPrincipal(userId, "tester", "");
            headers.setUser(new UsernamePasswordAuthenticationToken(principal, "token", principal.getAuthorities()));
        }
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }
}
