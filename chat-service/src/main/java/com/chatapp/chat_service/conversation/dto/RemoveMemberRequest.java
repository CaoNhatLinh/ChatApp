package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request để kick member khỏi conversation
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RemoveMemberRequest {
    private UUID userId;
    private String reason; 
}
