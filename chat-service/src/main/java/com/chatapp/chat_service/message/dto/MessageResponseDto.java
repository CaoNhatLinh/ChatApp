package com.chatapp.chat_service.message.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.file.dto.ImageDto;
import com.chatapp.chat_service.poll.dto.PollDto;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageResponseDto {
    private UUID messageId;
    private UUID conversationId;
    private UserDTO sender;
    private String content;
    private List<String> mentionedUsers;
    private String messageType; 
    private List<MessageAttachmentDto> attachments;
    private List<ImageDto> images;
    private List<AggregatedReactionDto> reactions;
    private ReplyToDto replyTo;
    private String replyType; 
    private boolean isForwarded;
    private boolean isDeleted;
    private Instant createdAt;
    private Instant updatedAt;
    private PollDto poll;
    private List<MessageReadReceiptDto> readReceipts;
    
    // Block status: true if the viewer has blocked this message's sender
    private boolean senderBlockedByViewer;
    
    private List<FileAttachmentDto> fileAttachments;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileAttachmentDto {
        private String url;          
        private String fileName;     
        private String contentType;  
        private Long fileSize;       
        private String resourceType; 
        private String publicId;     
        private String thumbnailUrl; 
        private String mediumUrl;    
        private String format;       
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageReadReceiptDto {
        private UUID readerId;
        private Instant readAt;
    }
}
