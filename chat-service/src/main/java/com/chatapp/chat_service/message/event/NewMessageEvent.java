package com.chatapp.chat_service.message.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewMessageEvent {
    private String type; 
    private NewMessagePayload payload;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NewMessagePayload {
        private UUID conversationId;
        private String messageType; 
        private String content;
        private List<UUID> mentions; 
        private UUID replyTo; 
        private List<Object> attachments; 
    }
}
