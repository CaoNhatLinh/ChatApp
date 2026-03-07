package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO cho invitation link
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitationLinkDto {
    private UUID linkId;
    private UUID conversationId;
    private String linkToken;
    private String fullLink; 
    private UUID createdBy;
    private String createdByUsername;
    private Instant createdAt;
    private Instant expiresAt;
    private boolean isActive;
    private Integer maxUses;
    private Integer usedCount;
    private boolean isExpired;
    private boolean canDelete; 
}
