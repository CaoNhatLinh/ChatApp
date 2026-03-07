package com.chatapp.chat_service.websocket.publisher;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
public class ReadReceiptPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public ReadReceiptPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishRead(UUID conversationId, UUID messageId, UUID readerId) {
        Map<String, Object> payload = Map.of(
                "messageId", messageId,
                "readerId", readerId
        );
        messagingTemplate.convertAndSend("/topic/read-receipt/" + conversationId, payload);
    }
}