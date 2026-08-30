package com.chatapp.chat_service.canonical.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class CqlCanonicalRecords {

    private CqlCanonicalRecords() {
    }

    public record CanonicalUser(
            UUID userId,
            String username,
            String usernameNormalized,
            String email,
            String emailNormalized,
            String passwordHash,
            String authProvider,
            String externalSubject,
            String displayName,
            String avatarUrl,
            String accountStatus,
            Instant createdAt,
            Instant updatedAt,
            Instant lastLoginAt) {
    }

    public record CanonicalConversation(
            UUID conversationId,
            String conversationType,
            String visibility,
            String joinPolicy,
            String name,
            String nameNormalized,
            String description,
            String avatarUrl,
            UUID avatarAssetId,
            UUID createdBy,
            UUID ownerId,
            Instant createdAt,
            Instant updatedAt,
            Boolean isDeleted,
            Instant deletedAt,
            String chatMode,
            Integer slowModeSeconds,
            Integer messageRetentionDays,
            String defaultNotificationLevel,
            String categoryId,
            Set<String> communityTags,
            String languageCode,
            Integer maxMembers,
            Integer memberCount,
            Boolean hasLastMessage,
            Instant lastActivityAt) {
    }

    public record CanonicalConversationMember(
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

    public record CanonicalMessage(
            UUID conversationId,
            String messageBucket,
            UUID messageId,
            UUID senderId,
            String messageType,
            String content,
            String contentFormat,
            UUID replyToMessageId,
            UUID replyToSenderId,
            UUID stickerId,
            UUID pollId,
            UUID systemEventId,
            UUID forwardedFromConversationId,
            String forwardedFromMessageBucket,
            UUID forwardedFromMessageId,
            Boolean isDeleted,
            UUID deletedBy,
            Instant deletedAt,
            Instant editedAt,
            Boolean hasAttachments,
            Boolean hasMentions,
            Boolean isPinned,
            Instant createdAt,
            UUID clientMessageId) {
    }

    public record CanonicalAttachment(
            UUID attachmentId,
            UUID assetId,
            String storageProvider,
            String storageKey,
            String fileName,
            String mimeType,
            Long byteSize,
            Integer width,
            Integer height,
            Long durationMs,
            String thumbnailUrl,
            Boolean isSpoiler) {
    }

    public record CanonicalPoll(
            UUID pollId,
            UUID conversationId,
            String messageBucket,
            UUID messageId,
            String question,
            List<String> options,
            Boolean isMultipleChoice,
            Boolean isAnonymous,
            Boolean isClosed,
            UUID createdBy,
            Instant createdAt,
            Instant closesAt,
            UUID closedBy,
            Instant closedAt) {
    }

    public record CanonicalInviteLink(
            UUID linkId,
            String linkToken,
            UUID conversationId,
            UUID createdBy,
            Instant createdAt,
            String inviteKind,
            String joinPolicy,
            String displayName,
            Instant expiresAt,
            Boolean isActive,
            Integer maxUses,
            Integer usedCount,
            UUID revokedBy,
            Instant revokedAt) {
    }

    public record CanonicalNotification(
            UUID userId,
            String notificationMonth,
            UUID notificationId,
            String notificationType,
            String priority,
            UUID conversationId,
            String messageBucket,
            UUID messageId,
            UUID actorId,
            String title,
            String bodyPreview,
            String deepLink,
            Map<String, String> actionPayload,
            Boolean isRead,
            Instant readAt,
            Instant createdAt) {
    }

    public record CanonicalNotificationSettings(
            UUID userId,
            String globalLevel,
            Boolean pushEnabled,
            Boolean emailEnabled,
            Boolean desktopEnabled,
            Boolean soundEnabled,
            String quietHoursStart,
            String quietHoursEnd,
            String timezone,
            Instant updatedAt) {
    }

    public record CanonicalChatPreferences(
            UUID userId,
            String defaultThemeId,
            String defaultBubbleStyleId,
            String defaultBackgroundAssetId,
            Instant updatedAt) {
    }

    public record CanonicalConversationPreferences(
            UUID userId,
            UUID conversationId,
            String themeId,
            String bubbleStyleId,
            String backgroundAssetId,
            String customBackgroundUrl,
            Instant updatedAt) {
    }

    public record CanonicalAnalyticsPoint(
            LocalDate eventDay,
            String eventType,
            Integer eventShard,
            UUID eventId,
            UUID actorId,
            UUID conversationId,
            Map<String, String> dimensions) {
    }

    public record CanonicalRoomAuditEvent(
            UUID actorId,
            String eventMonth,
            UUID eventId,
            String action,
            String resourceType,
            String resourceId,
            UUID conversationId,
            UUID targetUserId,
            String outcome,
            String reasonCode,
            Map<String, String> beforeState,
            Map<String, String> afterState,
            UUID requestId,
            String ipHash,
            String userAgentHash,
            Instant createdAt) {
    }

    public record CanonicalRoomEvent(
            UUID conversationId,
            String eventMonth,
            UUID eventId,
            String eventType,
            UUID actorId,
            UUID targetUserId,
            String messageBucket,
            UUID messageId,
            String reasonCode,
            Map<String, String> metadata,
            Instant createdAt) {
    }

    public record CanonicalCallSession(
            UUID conversationId,
            Instant startedAt,
            UUID callId,
            UUID startedBy,
            Instant endedAt,
            String callType,
            String status,
            String signalingProvider,
            String providerRoomId,
            String mediaRegion,
            Integer maxParticipants) {
    }
}
