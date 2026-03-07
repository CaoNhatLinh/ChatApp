package com.chatapp.chat_service.websocket.handler.connection;

import com.chatapp.chat_service.presence.service.PresenceService;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.chatapp.chat_service.websocket.service.WebSocketConnectionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketConnectHandler {

    private final WebSocketConnectionService connectionService;
    private final PresenceService presenceService;
    private final JwtTokenProvider jwtTokenProvider;
    @EventListener
    public void handleWebSocketConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        List<String> authHeaders = accessor.getNativeHeader("Authorization");
        String token = (authHeaders != null && !authHeaders.isEmpty())
                ? authHeaders.get(0).replace("Bearer ", "")
                : null;
        
        if (token != null && jwtTokenProvider.isTokenValid(token)) {
            try {
                UUID userId = jwtTokenProvider.extractUserId(token);
                String sessionId = accessor.getSessionId();
                
                accessor.getSessionAttributes().put("userId", userId.toString());
                
                connectionService.registerConnection(userId, sessionId, "web");
                presenceService.handleConnection(userId, sessionId);
                log.info("User connected: {} (session: {})", userId, sessionId);
            } catch (Exception e) {
                log.error("Error extracting user from token: {}", e.getMessage());
            }
        }
    }
}