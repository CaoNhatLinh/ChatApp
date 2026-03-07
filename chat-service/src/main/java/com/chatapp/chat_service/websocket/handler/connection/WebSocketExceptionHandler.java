package com.chatapp.chat_service.websocket.handler.connection;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.util.Map;

@ControllerAdvice
@RequiredArgsConstructor
public class WebSocketExceptionHandler {

    private final SimpMessagingTemplate simpMessagingTemplate;

    @MessageExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public void handleAuthenticationException(
            AuthenticationCredentialsNotFoundException ex,
            StompHeaderAccessor accessor
    ) {
        String sessionId = accessor.getSessionId();
        String errorMessage = "Authentication failed: " + ex.getMessage();

        simpMessagingTemplate.convertAndSendToUser(
                sessionId,
                "/queue/errors",
                Map.of("error", errorMessage)
        );
    }
}