package com.chatapp.chat_service.canonical.messaging;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class StompRealtimePublisher implements RealtimePublisher {

    private final SimpMessagingTemplate messaging;

    public StompRealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    @Override
    public void publishToUser(UUID userId, String destination, Object payload) {
        messaging.convertAndSendToUser(userId.toString(), destination, payload);
    }

    @Override
    public void publishToConversation(UUID conversationId, String destinationSuffix, Object payload) {
        messaging.convertAndSend("/topic/conversation/" + conversationId + destinationSuffix, payload);
    }
}
