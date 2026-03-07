package com.chatapp.chat_service.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationNotificationDto {
    private UUID conversationId;
    private String conversationName;
    private UUID lastMessageId;
    private String lastMessageContent;
    private String lastMessageSender;
    private java.time.Instant lastMessageTime;
    private long unreadCount;
    private String notificationType; 
}
