package com.chatapp.chat_service.canonical.model;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Canonical membership row; roleIds is bounded by the command service. */
public record ConversationMember(
        UUID conversationId,
        UUID userId,
        Set<UUID> roleIds,
        Instant joinedAt,
        UUID invitedBy,
        Instant mutedUntil,
        Integer messageIntervalSeconds,
        String notificationOverride,
        UUID lastReadMessageId,
        Instant lastReadAt) {
}
