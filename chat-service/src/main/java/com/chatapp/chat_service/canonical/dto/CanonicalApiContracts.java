package com.chatapp.chat_service.canonical.dto;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class CanonicalApiContracts {

    private CanonicalApiContracts() {
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 32) String username,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            @NotBlank @Size(max = 80) String displayName,
            String authProvider) {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password) {
    }

    public record UserResponse(
            UUID userId,
            String username,
            String email,
            String displayName,
            String avatarUrl,
            String accountStatus,
            Instant createdAt,
            Instant lastLoginAt) {
    }

    public record PublicUserResponse(
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            String accountStatus) {
    }

    public record UserSearchPage(
            List<PublicUserResponse> content,
            String nextCursor,
            boolean hasNext) {
    }

    public record UpdateProfileRequest(
            @NotBlank @Size(max = 80) String displayName,
            @Size(max = 2048) String avatarUrl) {
    }

    public record AuthResponse(String accessToken, UserResponse user) {
    }

    public record ConversationCreateRequest(
            String conversationType,
            String visibility,
            String joinPolicy,
            String name,
            String description,
            UUID createdBy,
            String avatarUrl,
            UUID avatarAssetId,
            String categoryId,
            Set<String> communityTags,
            String languageCode,
            Integer maxMembers,
            Integer messageRetentionDays,
            String chatMode,
            Integer slowModeSeconds,
            String defaultNotificationLevel,
            UUID firstMember,
            Set<UUID> memberIds) {
    }

    public record ConversationMemberRequest(UUID userId, Set<UUID> roleIds, String reason) {
    }

    public record ConversationMemberView(
            UUID userId,
            UUID conversationId,
            String role,
            Set<UUID> roleIds,
            Instant joinedAt,
            String username,
            String displayName,
            String avatarUrl,
            Instant mutedUntil,
            Integer messageIntervalSeconds) {
    }

    public record ConversationListItem(
            CqlCanonicalRecords.CanonicalConversation conversation,
            boolean pinned,
            int unreadCount,
            Instant joinedAt,
            String notificationOverride,
            LastMessageSummary lastMessage) {
    }

    public record CommunitySummary(
            UUID conversationId,
            String name,
            String description,
            String avatarUrl,
            String categoryId,
            Set<String> communityTags,
            String languageCode,
            String joinPolicy,
            Integer memberCount,
            Integer maxMembers,
            Instant lastActivityAt,
            String membershipStatus) {
    }

    public record CommunityPage(
            List<CommunitySummary> content,
            String nextCursor,
            boolean hasNext) {
    }

    public record CommunityJoinResponse(String status, UUID conversationId) {
    }

    public record ConversationNotificationPolicyView(
            String defaultNotificationLevel,
            String notificationOverride) {
    }

    public record LastMessageSummary(
            UUID messageId,
            UUID senderId,
            String senderDisplayName,
            String contentPreview,
            String messageType,
            Instant createdAt,
            boolean deleted,
            boolean hasAttachments) {
    }

    public record ConversationChatPolicyRequest(String chatMode, Integer slowModeSeconds) {
    }

    public record ConversationPermissionsView(Set<String> permissions, boolean owner) {
    }

    public record ConversationNotificationPolicyRequest(
            @NotBlank @Pattern(regexp = "ALL|MENTIONS|NONE") String defaultNotificationLevel) {
    }

    public record MemberNotificationPolicyRequest(
            @NotBlank @Pattern(regexp = "INHERIT|ALL|MENTIONS|NONE") String notificationOverride) {
    }

    public record MemberChatPolicyRequest(
            Instant mutedUntil,
            Integer messageIntervalSeconds,
            @NotBlank @Size(max = 500) String reason) {
    }

    public record ConversationRoleCreateRequest(
            String roleCode,
            String displayName,
            String colorHex,
            Set<String> permissionCodes,
            Boolean isDefault,
            Integer rolePosition) {
    }

    public record ConversationRoleUpdateRequest(
            @NotBlank String displayName,
            @NotBlank String colorHex,
            @NotNull Set<String> permissionCodes,
            @NotNull Boolean isDefault,
            @NotNull Integer rolePosition,
            @NotNull Instant expectedUpdatedAt) {
    }

    public record ConversationRoleAssignmentRequest(@NotNull Set<UUID> roleIds) {
    }

    public record MessageSendRequest(
            @NotNull UUID clientMessageId,
            String messageType,
            String content,
            String contentFormat,
            UUID replyToMessageId,
            UUID replyToSenderId,
            UUID stickerId,
            UUID pollId,
            UUID forwardedFromConversationId,
            String forwardedFromMessageBucket,
            UUID forwardedFromMessageId,
            List<AttachmentRequest> attachments,
            Set<UUID> mentionedUserIds) {
    }

    public record AttachmentRequest(
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

    public record MessageUpdateRequest(String content) {
    }

    public record MessagePage(
            List<CqlCanonicalRecords.CanonicalMessage> content,
            String nextCursor,
            boolean hasNext) {
    }

    public record MessageReactionRequest(String emoji) {
    }

    public record MessageReadReceiptView(UUID readerId, Instant readAt) {
    }

    public record MessageRevisionView(
            int revisionNumber,
            String content,
            String action,
            UUID editedBy,
            Instant editedAt) {
    }

    public record MessageSearchRequest(
            UUID conversationId,
            String q,
            UUID senderId,
            Instant fromAt,
            Instant toAt,
            Boolean hasAttachment,
            UUID mentionUserId,
            UUID replyToSenderId,
            String messageType,
            Boolean isPinned,
            Integer limit,
            String pageCursor) {
    }

    public record PollCreateRequest(
            UUID conversationId,
            UUID clientMessageId,
            String question,
            List<String> options,
            Boolean isMultipleChoice,
            Boolean isAnonymous,
            Instant closesAt) {
    }

    public record PollVoteRequest(Set<Integer> selectedOptionIndexes) {
    }

    public record PollView(
            CqlCanonicalRecords.CanonicalPoll poll,
            Map<Integer, Long> optionCounts,
            Set<Integer> currentUserOptionIndexes,
            Integer totalVoters,
            Map<Integer, Set<UUID>> voterIdsByOption) {
    }

    public record InviteLinkCreateRequest(
            UUID conversationId,
            String inviteKind,
            String joinPolicy,
            String displayName,
            Instant expiresAt,
            Integer maxUses,
            Integer durationMinutes) {
    }

    public record InviteConsumeRequest(String linkToken) {
    }

    public record InviteLinkView(CqlCanonicalRecords.CanonicalInviteLink invite, String joinUrl) {
    }

    public record InvitePreview(
            String status,
            UUID conversationId,
            String conversationName,
            String conversationType,
            UUID createdBy,
            String displayName,
            String joinPolicy,
            Instant expiresAt,
            Integer remainingUses) {
    }

    public record InviteConsumeResponse(String status, UUID conversationId) {
    }

    public record JoinRequestView(
            UUID conversationId,
            UUID requestedAt,
            UUID requestId,
            UUID userId,
            UUID linkId,
            String status,
            UUID resolvedBy,
            Instant resolvedAt) {
    }

    public record JoinRequestDecisionRequest(UUID requestedAt, UUID userId, String decision, String reason) {
    }

    public record FriendRequestCreateRequest(
            @NotNull UUID recipientId,
            @Size(max = 500) String message) {
    }

    public record FriendActionRequest(@NotNull UUID friendId) {
    }

    public record FriendUserSummary(
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            String accountStatus) {
    }

    public record FriendshipStatusResponse(
            String status,
            UUID userId,
            List<FriendUserSummary> userDetails) {
    }

    public record BlockStatusView(boolean hasBlocked, boolean isBlockedBy) {
    }

    public record NotificationSettingRequest(
            @NotBlank @Pattern(regexp = "ALL|MENTIONS|DIRECT_ONLY|NONE") String globalLevel,
            @NotNull Boolean pushEnabled,
            @NotNull Boolean emailEnabled,
            @NotNull Boolean desktopEnabled,
            @NotNull Boolean soundEnabled,
            @Pattern(regexp = "(?:[01]\\d|2[0-3]):[0-5]\\d") String quietHoursStart,
            @Pattern(regexp = "(?:[01]\\d|2[0-3]):[0-5]\\d") String quietHoursEnd,
            @Size(max = 64) String timezone) {
    }

    public record DeviceRegistrationRequest(
            @NotNull UUID deviceId,
            @NotBlank @Pattern(regexp = "WEB|IOS|ANDROID") String platform,
            @NotBlank @Pattern(regexp = "FCM|APNS|WEB_PUSH") String pushProvider,
            @Size(max = 4096) String pushToken,
            @Size(max = 120) String deviceName,
            @Size(max = 50) String appVersion) {
    }

    public record ChatAppearancePreferencesRequest(
            @NotBlank @Pattern(regexp = "aurora|neon|studio|vapor") String defaultThemeId,
            @NotBlank @Pattern(regexp = "tiktok|glass|classic") String defaultBubbleStyleId) {
    }

    public record ConversationAppearancePreferencesRequest(
            @NotBlank @Pattern(regexp = "aurora|neon|studio|vapor") String themeId,
            @Size(max = 2048) String customBackgroundUrl) {
    }

}
