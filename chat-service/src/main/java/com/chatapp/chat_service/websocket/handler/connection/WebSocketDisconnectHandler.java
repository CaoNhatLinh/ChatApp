package com.chatapp.chat_service.websocket.handler.connection;


import com.chatapp.chat_service.presence.service.PresenceService;
import com.chatapp.chat_service.websocket.service.WebSocketConnectionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketDisconnectHandler {

    private final WebSocketConnectionService connectionService;
    private final PresenceService presenceService;

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        
        Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
        String userIdStr = sessionAttrs != null ? (String) sessionAttrs.get("userId") : null;

        if (userIdStr != null) {
            try {
                UUID userId = UUID.fromString(userIdStr);
                String sessionId = accessor.getSessionId();
                log.info("User disconnected: {} (session: {})", userId, sessionId);

                connectionService.unregisterConnection(userId, sessionId);
                presenceService.handleDisconnect(userId, sessionId);

            } catch (IllegalArgumentException e) {
                log.error("Invalid userId in session attributes: {}", userIdStr);
            }
        } else {
            log.warn("Disconnect event with no userId in session attributes (session: {})", accessor.getSessionId());
        }
    }
}
