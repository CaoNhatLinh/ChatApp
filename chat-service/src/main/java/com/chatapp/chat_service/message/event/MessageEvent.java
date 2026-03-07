package com.chatapp.chat_service.message.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.chatapp.chat_service.message.dto.MessageRequest;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageEvent {
    private UUID messageId;
    private UUID conversationId;
    private UUID senderId;
    private String content;
    private Instant createdAt;
    private List<UUID> mentionedUserIds;
    private UUID replyTo;
    private Instant timestamp;
    
    private String type; 
    private MessagePayload payload;
    
    private MessageRequest messageRequest;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessagePayload {
        private UUID conversationId;
        private String type; 
        private String content;
        private List<UUID> mentions; 
        private UUID replyTo; 
        private List<MessageRequest.FileAttachment> attachments; 
    }
    
    public static MessageEvent fromWebSocketPayload(String type, MessagePayload payload, UUID senderId) {
        return MessageEvent.builder()
                .type(type)
                .payload(payload)
                .conversationId(payload.getConversationId())
                .senderId(senderId)
                .content(payload.getContent())
                .mentionedUserIds(payload.getMentions())
                .replyTo(payload.getReplyTo())
                .timestamp(Instant.now())
                .build();
    }
    
    public static MessageEvent forKafkaProcessing(MessageRequest messageRequest) {
        return MessageEvent.builder()
                .messageRequest(messageRequest)
                .type(messageRequest.getType())
                .conversationId(messageRequest.getConversationId())
                .senderId(messageRequest.getSenderId())
                .content(messageRequest.getContent())
                .mentionedUserIds(messageRequest.getMentionedUserIds())
                .replyTo(messageRequest.getReplyTo())
                .timestamp(Instant.now())
                .build();
    }
}
