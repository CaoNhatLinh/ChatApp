package com.chatapp.chat_service.canonical.model;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Canonical row contract for conversation_roles_by_conversation. */
public record ConversationRole(
        UUID conversationId,
        int rolePosition,
        UUID roleId,
        String roleCode,
        String displayName,
        String colorHex,
        Set<ConversationPermission> permissions,
        boolean isDefault,
        boolean isSystem,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt) {
}
