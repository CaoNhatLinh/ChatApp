package com.chatapp.chat_service.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.Valid;
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
    @NotNull(message = "Conversation id is required")
    private UUID conversationId;
    private UUID senderId;
    @Size(max = 10000, message = "Message content must not exceed 10000 characters")
    private String content;
    private UUID replyTo;
    @NotBlank(message = "Message type is required")
    private String type;
    private List<UUID> mentionedUserIds;

    @Valid
    @Size(max = 10, message = "Too many attachments. Maximum is 10.")
    private List<FileAttachment> attachments;

    @AssertTrue(message = "Message must include text or at least one attachment.")
    private boolean isPayloadValid() {
        boolean hasText = content != null && !content.trim().isEmpty();
        boolean hasAttachment = attachments != null && !attachments.isEmpty();
        return hasText || hasAttachment;
    }

    public UUID getReplyToId() {
        return replyTo;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileAttachment {
        @NotBlank(message = "Attachment URL is required")
        private String url;          
        @NotBlank(message = "Attachment file name is required")
        private String fileName;     
        @NotBlank(message = "Attachment content type is required")
        private String contentType;  
        @NotNull(message = "Attachment file size is required")
        private Long fileSize;       
        private String resourceType; 
        private String publicId;     
        private String thumbnailUrl; 
        private String mediumUrl;    
    }
}
