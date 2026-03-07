package com.chatapp.chat_service.message.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageAttachmentDto {
    private UUID attachmentId;
    private String attachmentType;
    private String fileName;
    private String url;
    private Long fileSize;
    private String mimeType;
}
