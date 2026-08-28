package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.security.core.AppUserPrincipal;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

@Component
public class StompAuthenticationInterceptor implements ChannelInterceptor {
    private final JwtTokenProvider tokens;
    private final ConversationAuthorizationService authorization;
    private final AppAuthorizationService appAuthorization;
    private final CanonicalCqlStore users;

    public StompAuthenticationInterceptor(
            JwtTokenProvider tokens,
            ConversationAuthorizationService authorization,
            AppAuthorizationService appAuthorization) {
        this(tokens, authorization, appAuthorization, null);
    }

    @Autowired
    public StompAuthenticationInterceptor(
            JwtTokenProvider tokens,
            ConversationAuthorizationService authorization,
            AppAuthorizationService appAuthorization,
            CanonicalCqlStore users) {
        this.tokens = tokens;
        this.authorization = authorization;
        this.appAuthorization = appAuthorization;
        this.users = users;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticate(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscription(accessor);
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
        if (users != null) {
            var currentUser = users.findUserById(userId);
            if (currentUser == null || !"ACTIVE".equalsIgnoreCase(currentUser.accountStatus())) {
                throw new IllegalArgumentException("account is not active");
            }
        }
        AppUserPrincipal principal = new AppUserPrincipal(
                userId, tokens.extractUsername(token), "", appAuthorization.authorities(userId));
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                principal, token, principal.getAuthorities()));
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof UsernamePasswordAuthenticationToken authentication)
                || !(authentication.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new IllegalArgumentException("Authenticated STOMP session is required");
        }
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }
        if (destination.startsWith("/topic/conversation/")) {
            String conversationId = destination.substring("/topic/conversation/".length()).split("/", 2)[0];
            authorization.requireMember(UUID.fromString(conversationId), principal.getUserId());
        }
        if (destination.startsWith("/topic/user/")) {
            String targetUserId = destination.substring("/topic/user/".length()).split("/", 2)[0];
            if (!principal.getUserId().equals(UUID.fromString(targetUserId))) {
                throw new IllegalArgumentException("Cannot subscribe to another user's topic");
            }
        }
    }
}
