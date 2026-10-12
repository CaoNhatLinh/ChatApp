package com.chatapp.chat_service.canonical.moderation;

import java.time.Instant;
import java.util.UUID;
import java.util.List;

public interface ConversationModerationRepository {
    void ban(UUID conversationId, UUID userId, UUID bannedBy, String reasonCode, String reasonText, Instant expiresAt);
    boolean isBanned(UUID conversationId, UUID userId, Instant now);
    void clearBan(UUID conversationId, UUID userId);
    boolean clearBanIfUnchanged(UUID conversationId, UUID userId, Instant expiresAt);
    boolean clearMuteIfUnchanged(UUID conversationId, UUID userId, Instant mutedUntil);
    List<ConversationBan> listBans(UUID conversationId, Instant now, int limit);

    record ConversationBan(
            UUID conversationId,
            UUID userId,
            UUID bannedBy,
            String reasonCode,
            String reasonText,
            Instant createdAt,
            Instant expiresAt) {
    }
}
