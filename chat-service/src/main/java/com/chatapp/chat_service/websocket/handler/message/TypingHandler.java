package com.chatapp.chat_service.websocket.handler.message;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TypingHandler extends TextWebSocketHandler {
    private final ObjectMapper objectMapper;
    private final Map<UUID, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public TypingHandler( ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        UUID userId = extractUserIdFromSession(session);
        if (userId != null) {
            sessions.put(userId, session);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        UUID userId = extractUserIdFromSession(session);
        if (userId != null) {
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        UUID userId = extractUserIdFromSession(session);
        if (userId != null) {
            sessions.remove(userId);
        }
    }

    private UUID extractUserIdFromSession(WebSocketSession session) {
        try {
            String query = session.getUri().getQuery();
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("token=")) {
                    String token = param.substring(6);
                    return UUID.fromString(token); 
                }
            }
        } catch (Exception e) {
        }
        return null;
    }
}