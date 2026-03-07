package com.chatapp.chat_service.poll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PollCreationRequest {
    private UUID conversationId;
    private UUID messageId;
    private String question;
    private List<String> options;
    private boolean isMultipleChoice;
    private boolean isAnonymous;
    private Instant expiresAt;
}
