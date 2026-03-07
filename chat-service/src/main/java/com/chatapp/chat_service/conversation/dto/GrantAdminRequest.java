package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request để trao quyền admin
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrantAdminRequest {
    private UUID userId;
}
