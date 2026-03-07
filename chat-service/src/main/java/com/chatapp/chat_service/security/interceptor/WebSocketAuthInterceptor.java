package com.chatapp.chat_service.security.interceptor;

import com.chatapp.chat_service.security.core.AppUserPrincipal;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.UUID;

/**
 * ✅ WebSocket Authentication Interceptor
 * - Authenticate CONNECT message with JWT token
 * - Extract userId & set in SecurityContext
 * - Propagate user principal to all subsequent STOMP frames
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider tokenProvider;

    private static final String BEARER_PREFIX = "Bearer ";
    private static final int BEARER_LENGTH = 7;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            accessor = StompHeaderAccessor.wrap(message);
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticateWebSocketConnection(accessor);
            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
        }

        return message;
    }

    /**
     * Authenticate WebSocket connection
     */
    private void authenticateWebSocketConnection(StompHeaderAccessor accessor) {
        try {
            String token = extractTokenFromHeaders(accessor);

            if (token == null || !tokenProvider.isTokenValid(token)) {
                log.warn("⚠️ Invalid or missing WebSocket token");
                throw new RuntimeException("Invalid authentication token");
            }

            String username = tokenProvider.extractUsername(token);
            UUID userId = tokenProvider.extractUserId(token);

            log.debug("✅ WebSocket authenticated: user={}, userId={}", username, userId);

            AppUserPrincipal principal = new AppUserPrincipal(
                    userId,
                    username,
                    "N/A",
                    Collections.emptyList()
            );

            Authentication auth = new UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    Collections.emptyList()
            );

            accessor.setUser(auth);

        } catch (Exception ex) {
            log.error("❌ WebSocket authentication failed: {}", ex.getMessage());
            throw new RuntimeException("Authentication failed: " + ex.getMessage(), ex);
        }
    }

    /**
     * Extract JWT token from WebSocket headers
     */
    private String extractTokenFromHeaders(StompHeaderAccessor accessor) {
        java.util.List<String> authHeaders = accessor.getNativeHeader("Authorization");

        if (authHeaders != null && !authHeaders.isEmpty()) {
            String authHeader = authHeaders.get(0);
            if (authHeader.startsWith(BEARER_PREFIX)) {
                return authHeader.substring(BEARER_LENGTH);
            }
        }

        return null;
    }
}