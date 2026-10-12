package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.security.core.AppUserPrincipal;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import java.util.concurrent.ConcurrentHashMap;

import java.util.UUID;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class StompAuthenticationInterceptor implements ChannelInterceptor {
    private static final Set<String> COMMANDS = Set.of(
            "/app/typing", "/app/heartbeat", "/app/online-status", "/app/presence.logout",
            "/app/presence.subscribe", "/app/presence.unsubscribe", "/app/presence.batch",
            "/app/call.start", "/app/call.join", "/app/call.leave", "/app/call.signal", "/app/call.end");
    private static final Set<String> USER_QUEUES = Set.of(
            "/user/queue/presence", "/user/queue/presence-sync", "/user/queue/presence-batch",
            "/user/queue/notifications", "/user/queue/notification-read", "/user/queue/notification-delete",
            "/user/queue/friend-requests", "/user/queue/conversation-list-update");
    private static final Pattern CONVERSATION_TOPIC = Pattern.compile(
            "^/topic/conversation/([0-9a-fA-F-]{36})(?:/(typing|calls|reactions|read|polls|pins|attachments))?$");
    private static final Pattern USER_TOPIC = Pattern.compile(
            "^/topic/user/([0-9a-fA-F-]{36})/new-message$");
    private final JwtTokenProvider tokens;
    private final ConversationAuthorizationService authorization;
    private final AppAuthorizationService appAuthorization;
    private final UserRepository users;
    private final ConcurrentHashMap<String, SessionAccess> sessions = new ConcurrentHashMap<>();

    @Autowired
    public StompAuthenticationInterceptor(
            JwtTokenProvider tokens,
            ConversationAuthorizationService authorization,
            AppAuthorizationService appAuthorization,
            UserRepository users) {
        this.tokens = tokens;
        this.authorization = authorization;
        this.appAuthorization = appAuthorization;
        this.users = users;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) throw new IllegalArgumentException("STOMP headers are required");
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticate(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscription(accessor);
        } else if (StompCommand.SEND.equals(accessor.getCommand())) {
            requirePrincipal(accessor);
            if (!COMMANDS.contains(accessor.getDestination())) {
                throw new IllegalArgumentException("Client SEND destination is not allowed");
            }
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorizationHeader = accessor.getFirstNativeHeader("Authorization");
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Bearer token is required for STOMP CONNECT");
        }
        String token = authorizationHeader.substring(7);
        if (!tokens.isTokenValid(token)) {
            throw new IllegalArgumentException("Invalid or expired STOMP token");
        }
        UUID userId = tokens.extractUserId(token);
        requireActive(userId, token);
        AppUserPrincipal principal = new AppUserPrincipal(
                userId, tokens.extractUsername(token), "", appAuthorization.authorities(userId));
        accessor.setUser(new StompUserAuthentication(principal, token));
        if (accessor.getSessionId() == null) {
            throw new IllegalArgumentException("STOMP session ID is required");
        }
        sessions.put(accessor.getSessionId(), new SessionAccess(userId, token));
    }

    private AppUserPrincipal requirePrincipal(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof UsernamePasswordAuthenticationToken authentication)
                || !(authentication.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new IllegalArgumentException("Authenticated STOMP session is required");
        }
        requireActive(principal.getUserId(), String.valueOf(authentication.getCredentials()));
        return principal;
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        AppUserPrincipal principal = requirePrincipal(accessor);
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new IllegalArgumentException("STOMP subscription destination is required");
        }
        var conversation = CONVERSATION_TOPIC.matcher(destination);
        if (conversation.matches()) {
            authorization.requireMember(UUID.fromString(conversation.group(1)), principal.getUserId());
            return;
        }
        var userTopic = USER_TOPIC.matcher(destination);
        if (userTopic.matches()) {
            if (!principal.getUserId().equals(UUID.fromString(userTopic.group(1)))) {
                throw new IllegalArgumentException("Cannot subscribe to another user's topic");
            }
            return;
        }
        if (!USER_QUEUES.contains(destination)) {
            throw new IllegalArgumentException("STOMP subscription destination is not allowed");
        }
    }

    private void requireActive(UUID userId, String token) {
        if (!tokens.isTokenValid(token)) {
            throw new IllegalArgumentException("Invalid or expired STOMP token");
        }
        var user = users.findById(userId);
        if (user == null || !"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw new IllegalArgumentException("account is not active");
        }
    }

    boolean canDeliver(Message<?> message) {
        var headers = SimpMessageHeaderAccessor.wrap(message);
        String sessionId = headers.getSessionId();
        SessionAccess session = sessionId == null ? null : sessions.get(sessionId);
        if (session == null) return false;
        try {
            requireActive(session.userId(), session.token());
            String destination = headers.getDestination();
            if (destination == null) return false;
            var conversation = CONVERSATION_TOPIC.matcher(destination);
            if (conversation.matches()) {
                authorization.requireMember(UUID.fromString(conversation.group(1)), session.userId());
            }
            var userTopic = USER_TOPIC.matcher(destination);
            return !userTopic.matches() || session.userId().equals(UUID.fromString(userTopic.group(1)));
        } catch (RuntimeException deniedOrUnavailable) {
            // Fail closed on revoked access and unavailable authority storage.
            return false;
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        sessions.remove(event.getSessionId());
    }

    private record SessionAccess(UUID userId, String token) {}

    private static final class StompUserAuthentication extends UsernamePasswordAuthenticationToken {
        private StompUserAuthentication(AppUserPrincipal principal, String token) {
            super(principal, token, principal.getAuthorities());
        }

        @Override
        public String getName() {
            // User destinations are keyed by user ID, not the mutable username.
            return ((AppUserPrincipal) getPrincipal()).getName();
        }
    }
}
