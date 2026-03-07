package com.chatapp.chat_service.message.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageRequest {
    private UUID messageId; 
    private UUID conversationId;
    private UUID senderId;
    private String content;
    private UUID replyTo;
    private String type; 
    private List<UUID> mentionedUserIds;
    
    private List<FileAttachment> attachments;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileAttachment {
        private String url;          
        private String fileName;     
        private String contentType;  
        private Long fileSize;       
        private String resourceType; 
        private String publicId;     
        private String thumbnailUrl; 
        private String mediumUrl;    
    }
}
