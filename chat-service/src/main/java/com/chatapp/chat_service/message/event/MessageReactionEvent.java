package com.chatapp.chat_service.message.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReactionEvent {
    private UUID conversationId;
    private UUID messageId;
    private String emoji;
    private UUID userId;
    private String action; 
    private Instant timestamp;
}
