package com.chatapp.chat_service.message.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageRevisionDto {
    private Integer revisionNumber;
    private String content;
    private Instant editedAt;
    private UUID editedBy;
    private String action;
}