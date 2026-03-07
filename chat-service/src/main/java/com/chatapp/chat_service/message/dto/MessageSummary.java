package com.chatapp.chat_service.message.dto;


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
public class MessageSummary {
    private UUID messageId;
    private UUID senderId;
    private String content;
    private String type;
    private Instant createdAt;
}