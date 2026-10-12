package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.notification.NotificationSettingsPolicy;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    private final CanonicalCqlStore store;
    private final CanonicalConversationRepository conversationRepository;
    private final ConversationAuthorizationService authorization;
    private final CanonicalEventRecorder eventRecorder;
    private final AdminConversationDirectoryRepository adminConversationDirectory;
    private final UserRepository users;
    private final ConversationMembershipService memberships;

    @Autowired
    public ConversationService(
            CanonicalCqlStore store,
            CanonicalConversationRepository conversationRepository,
            ConversationAuthorizationService authorization,
            CanonicalEventRecorder eventRecorder,
            AdminConversationDirectoryRepository adminConversationDirectory,
            UserRepository users,
            ConversationMembershipService memberships) {
        this.store = store;
        this.conversationRepository = conversationRepository;
        this.authorization = authorization;
        this.eventRecorder = eventRecorder;
        this.adminConversationDirectory = adminConversationDirectory;
        this.users = users;
        this.memberships = memberships;
    }

    private void requireAuthenticatedActor(UUID actorId) {
        if (actorId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    public CanonicalConversation createConversation(UUID actorId, CanonicalApiContracts.ConversationCreateRequest req) {
        if (actorId == null) {
            throw new ForbiddenException("auth required");
        }
        if (!StringUtils.hasText(req.conversationType())) {
            throw new BadRequestException("conversationType required");
        }
        Instant now = Instant.now();
        String conversationType = req.conversationType().trim().toUpperCase();
        if (!Set.of("DM", "GROUP", "CHANNEL").contains(conversationType)) {
            throw new BadRequestException("conversationType must be DM, GROUP, or CHANNEL");
        }
        String name = StringUtils.hasText(req.name()) ? req.name().trim() : defaultConversationName(conversationType);
        if (name.length() > 100) {
            throw new BadRequestException("conversation name must not exceed 100 characters");
        }
        if (req.description() != null && req.description().length() > 2000) {
            throw new BadRequestException("conversation description must not exceed 2000 characters");
        }
        int slowModeSeconds = req.slowModeSeconds() == null ? 0 : req.slowModeSeconds();
        if (slowModeSeconds < 0 || slowModeSeconds > 86_400) {
            throw new BadRequestException("slowModeSeconds must be between 0 and 86400");
        }
        int maxMembers = req.maxMembers() == null ? ("DM".equals(conversationType) ? 2 : 10_000) : req.maxMembers();
        if (maxMembers < 2 || maxMembers > 100_000 || "DM".equals(conversationType) && maxMembers != 2) {
            throw new BadRequestException("maxMembers is invalid for the conversation type");
        }
        UUID conversationId = UUID.randomUUID();
        Set<UUID> requestedMemberIds = new HashSet<>(req.memberIds() == null ? Set.of() : req.memberIds());
        requestedMemberIds.remove(actorId);
        UUID conversationBucketUser = req.firstMember();
        if (conversationBucketUser == null && "DM".equals(conversationType) && requestedMemberIds.size() == 1) {
            conversationBucketUser = requestedMemberIds.iterator().next();
        }

        if ("DM".equalsIgnoreCase(conversationType)) {
            if (conversationBucketUser == null || conversationBucketUser.equals(actorId)
                    || !requestedMemberIds.isEmpty() && !requestedMemberIds.equals(Set.of(conversationBucketUser))) {
                throw new BadRequestException("DM requires exactly one other member");
            }
            requestedMemberIds = Set.of(conversationBucketUser);
        }

        if (requestedMemberIds.size() + 1 > maxMembers) {
            throw new BadRequestException("initial members exceed maxMembers");
        }
        if (requestedMemberIds.size() > 200) {
            throw new BadRequestException("initial members must not exceed 200; add remaining members after creation");
        }
        for (UUID memberId : requestedMemberIds) {
            CanonicalUser memberUser = users.findById(memberId);
            if (memberUser == null || !"ACTIVE".equalsIgnoreCase(memberUser.accountStatus())) {
                throw new BadRequestException("initial member is not an active user: " + memberId);
            }
        }

        String visibility = "DM".equals(conversationType)
                ? "PRIVATE"
                : normalize(req.visibility(), "PRIVATE_LINK").toUpperCase(Locale.ROOT);
        if (!Set.of("PRIVATE", "PRIVATE_LINK", "COMMUNITY").contains(visibility)) {
            throw new BadRequestException("visibility must be PRIVATE, PRIVATE_LINK, or COMMUNITY");
        }
        if ("COMMUNITY".equals(visibility) && !"CHANNEL".equals(conversationType)) {
            throw new BadRequestException("only CHANNEL conversations can be public communities");
        }
        String joinPolicy = "DM".equals(conversationType)
                ? "CLOSED"
                : normalize(req.joinPolicy(), "INVITE_ONLY").toUpperCase(Locale.ROOT);
        if (!Set.of("CLOSED", "INVITE_ONLY", "DIRECT_JOIN", "REQUEST_APPROVAL").contains(joinPolicy)) {
            throw new BadRequestException("invalid joinPolicy");
        }

        // Claims are durable: reject all invalid input before reserving a DM pair.
        if ("DM".equals(conversationType)) {
            String pairKey = buildDmPairKey(actorId, conversationBucketUser);
            UUID existed = store.findDmPair(pairKey);
            if (existed != null) {
                CanonicalConversation existing = store.findConversation(existed);
                if (existing != null) return existing;
            }
            UUID winner = store.claimDmPair(pairKey, conversationId, now);
            if (!conversationId.equals(winner)) {
                CanonicalConversation existing = store.findConversation(winner);
                if (existing != null) return existing;
                throw new ConflictException("direct message creation is already in progress; retry");
            }
        }

        CanonicalConversation conversation = new CqlCanonicalRecords.CanonicalConversation(
                conversationId,
                conversationType,
                visibility,
                joinPolicy,
                name,
                normalize(name),
                req.description(),
                req.avatarUrl(),
                req.avatarAssetId(),
                actorId,
                actorId,
                now,
                now,
                false,
                null,
                normalize(req.chatMode(), "OPEN"),
                slowModeSeconds,
                req.messageRetentionDays(),
                normalize(req.defaultNotificationLevel(), "ALL"),
                req.categoryId(),
                req.communityTags() == null ? Set.of() : req.communityTags(),
                req.languageCode(),
                maxMembers,
                requestedMemberIds.size() + 1,
                false,
                now
        );
        store.saveConversation(conversation);

        Set<UUID> ownerRoleIds = Set.of();
        if (!"DM".equals(conversationType)) {
            ownerRoleIds = createSystemConversationRoles(conversationId, actorId, now);
        }

        CanonicalConversationMember owner = new CqlCanonicalRecords.CanonicalConversationMember(
                conversationId,
                actorId,
                ownerRoleIds,
                now,
                actorId,
                null,
                null,
                "INHERIT",
                null,
                now
        );
        List<CanonicalConversationMember> initialMembers = new ArrayList<>();
        initialMembers.add(owner);
        for (UUID memberId : requestedMemberIds) {
            CanonicalConversationMember peer = new CqlCanonicalRecords.CanonicalConversationMember(
                    conversationId,
                    memberId,
                    "DM".equals(conversationType) ? Set.of() : defaultRoleIds(conversationId),
                    now,
                    actorId,
                    null,
                    null,
                    "INHERIT",
                    null,
                    now
            );
            initialMembers.add(peer);
        }
        store.createConversationMembership(
                initialMembers, maxMembers, conversation.ownerId(), conversation.createdAt());
        initialMembers.forEach(member ->
                store.addConversationMembershipProjection(member.userId(), conversation, member));
        adminConversationDirectory.index(conversation);
        store.indexCommunityConversation(conversation);

        appendAudit(actorId, conversationId, "CONVERSATION_CREATE", "conversation", conversationId.toString(), null, null);
        return conversation;
    }

    public CanonicalConversation getConversation(UUID conversationId) {
        CanonicalConversation conv = store.findConversation(conversationId);
        if (conv == null) {
            throw new NotFoundException("conversation not found");
        }
        return conv;
    }

    public CanonicalApiContracts.ConversationNotificationPolicyView getConversationNotificationPolicy(
            UUID actorId, UUID conversationId) {
        authorization.requireMember(conversationId, actorId);
        CanonicalConversation conversation = getConversation(conversationId);
        CanonicalConversationMember member = store.findConversationMember(conversationId, actorId);
        if (member == null) {
            throw new ForbiddenException("not member of conversation");
        }
        return new CanonicalApiContracts.ConversationNotificationPolicyView(
                NotificationSettingsPolicy.requireRoomLevel(conversation.defaultNotificationLevel()),
                NotificationSettingsPolicy.requireOverride(member.notificationOverride()));
    }

    public CanonicalConversation findMyDm(UUID actorId, UUID otherUserId) {
        if (actorId.equals(otherUserId)) {
            throw new BadRequestException("the DM peer must be another user");
        }
        UUID conversationId = store.findDmPair(buildDmPairKey(actorId, otherUserId));
        if (conversationId == null || store.findConversationMember(conversationId, actorId) == null) {
            throw new NotFoundException("direct message conversation not found");
        }
        CanonicalConversation conversation = getConversation(conversationId);
        if (!"DM".equalsIgnoreCase(conversation.conversationType())) {
            throw new NotFoundException("direct message conversation not found");
        }
        return conversation;
    }

    public CanonicalApiContracts.ConversationMemberPage listConversationMembers(
            UUID actorId, UUID conversationId, UUID afterUserId, int requestedLimit) {
        requireMember(conversationId, actorId);
        CanonicalConversation conversation = getConversation(conversationId);
        int limit = Math.max(1, Math.min(500, requestedLimit));
        List<CanonicalConversationMember> rows = store.listConversationMembers(
                conversationId, afterUserId, limit + 1);
        boolean hasNext = rows.size() > limit;
        List<CanonicalConversationMember> pageRows = hasNext ? rows.subList(0, limit) : rows;
        List<CanonicalApiContracts.ConversationMemberView> content = pageRows.stream()
                .map(member -> {
                    CanonicalUser user = users.findById(member.userId());
                    if (user == null) {
                        throw new IllegalStateException("conversation member references a missing user");
                    }
                    return new CanonicalApiContracts.ConversationMemberView(
                            member.userId(),
                            member.conversationId(),
                            member.userId().equals(conversation.ownerId()) ? "owner" : "member",
                            member.roleIds(),
                            member.joinedAt(),
                            user.username(),
                            user.displayName(),
                            user.avatarUrl(),
                            member.mutedUntil(),
                            member.messageIntervalSeconds());
                })
                .toList();
        UUID nextCursor = hasNext ? pageRows.get(pageRows.size() - 1).userId() : null;
        return new CanonicalApiContracts.ConversationMemberPage(content, nextCursor, hasNext);
    }

    public CanonicalApiContracts.ConversationPage listMyConversations(UUID actorId, String cursor, int requestedLimit) {
        int limit = Math.max(10, Math.min(100, requestedLimit));
        CanonicalCqlStore.ConversationProjectionCursor decoded = decodeConversationCursor(cursor);
        List<CanonicalCqlStore.ConversationProjectionRow> rows = store.listConversationProjectionByUser(
                actorId, decoded, limit + 1);
        boolean hasNext = rows.size() > limit;
        List<CanonicalCqlStore.ConversationProjectionRow> pageRows = hasNext
                ? rows.subList(0, limit)
                : rows;
        List<CanonicalApiContracts.ConversationListItem> content = pageRows.stream()
                .map(row -> new CanonicalApiContracts.ConversationListItem(
                        row.conversation(),
                        row.pinned(),
                        row.unreadCount(),
                        row.joinedAt(),
                        row.notificationOverride(),
                        row.lastMessage() == null ? null : new CanonicalApiContracts.LastMessageSummary(
                                row.lastMessage().messageId(),
                                row.lastMessage().senderId(),
                                row.lastMessage().senderDisplayName(),
                                row.lastMessage().contentPreview(),
                                row.lastMessage().messageType(),
                                row.lastMessage().createdAt(),
                                row.lastMessage().deleted(),
                                row.lastMessage().hasAttachments())))
                .toList();
        String nextCursor = hasNext
                ? encodeConversationCursor(pageRows.get(pageRows.size() - 1))
                : null;
        return new CanonicalApiContracts.ConversationPage(content, nextCursor, hasNext);
    }

    private String encodeConversationCursor(CanonicalCqlStore.ConversationProjectionRow row) {
        String value = (row.pinned() ? "1" : "0") + "|"
                + row.lastActivityAt() + "|" + row.conversation().conversationId();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private CanonicalCqlStore.ConversationProjectionCursor decodeConversationCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = value.split("\\|", -1);
            if (parts.length != 3 || (!"0".equals(parts[0]) && !"1".equals(parts[0]))) {
                throw new IllegalArgumentException("invalid conversation cursor");
            }
            Instant lastActivityAt = Instant.parse(parts[1]);
            UUID conversationId = UUID.fromString(parts[2]);
            return new CanonicalCqlStore.ConversationProjectionCursor("1".equals(parts[0]), lastActivityAt, conversationId);
        } catch (RuntimeException exception) {
            throw new BadRequestException("invalid conversation cursor");
        }
    }

    public void addMember(UUID actorId, UUID conversationId, CanonicalApiContracts.ConversationMemberRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_INVITE);
        if (req == null || req.userId() == null) {
            throw new BadRequestException("userId is required");
        }
        CanonicalConversation conversation = getConversation(conversationId);
        if ("DM".equals(conversation.conversationType())) {
            throw new BadRequestException("direct messages cannot add extra members");
        }
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            throw new ConflictException("archived conversations cannot add members");
        }
        CanonicalUser invitedUser = users.findById(req.userId());
        if (invitedUser == null || !"ACTIVE".equalsIgnoreCase(invitedUser.accountStatus())) {
            throw new BadRequestException("invited user must be an active account");
        }
        Set<UUID> roleIds = req.roleIds() == null || req.roleIds().isEmpty()
                ? defaultRoleIds(conversationId)
                : req.roleIds();
        CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                conversationId,
                req.userId(),
                roleIds,
                Instant.now(),
                actorId,
                null,
                null,
                "INHERIT",
                null,
                Instant.now()
        );
        var result = memberships.claim(member);
        if (result == ConversationMembershipService.MembershipClaimResult.BANNED) {
            throw new ForbiddenException("user is banned from this conversation");
        }
        if (result == ConversationMembershipService.MembershipClaimResult.CAPACITY_REACHED) {
            throw new ConflictException("conversation capacity has been reached");
        }
        CanonicalConversationMember currentMember = result == ConversationMembershipService.MembershipClaimResult.ADDED
                ? member
                : store.findConversationMember(conversationId, req.userId());
        if (currentMember == null) {
            throw new IllegalStateException("conversation member is missing after membership claim");
        }
        repairMembershipProjections(currentMember);
        if (result == ConversationMembershipService.MembershipClaimResult.ALREADY_MEMBER) {
            return;
        }
        appendAudit(actorId, conversationId, "MEMBER_ADD", "conversation", conversationId.toString(), req.userId(), "reason=" + req.reason());
    }

    public void removeMember(UUID actorId, UUID conversationId, UUID removedUserId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_KICK);
        CanonicalConversation conversation = getConversation(conversationId);
        if (removedUserId.equals(conversation.ownerId())) {
            throw new ConflictException("conversation owner cannot be kicked");
        }
        if (store.findConversationMember(conversationId, removedUserId) == null) {
            throw new NotFoundException("conversation member not found");
        }
        CanonicalCqlStore.MembershipMutationResult result =
                store.tryRemoveConversationMember(conversationId, removedUserId);
        if (result == CanonicalCqlStore.MembershipMutationResult.OWNER_PROTECTED) {
            throw new ConflictException("conversation owner cannot be kicked");
        }
        if (result == CanonicalCqlStore.MembershipMutationResult.NOT_MEMBER) {
            adminConversationDirectory.index(getConversation(conversationId));
            return;
        }
        adminConversationDirectory.index(getConversation(conversationId));
        appendAudit(actorId, conversationId, "MEMBER_REMOVE", "conversation", conversationId.toString(), removedUserId, "removed");
    }

    public void leaveConversation(UUID actorId, UUID conversationId) {
        authorization.requireMember(conversationId, actorId);
        CanonicalConversation conversation = getConversation(conversationId);
        if (actorId.equals(conversation.ownerId())) {
            throw new ConflictException("transfer ownership before leaving the conversation");
        }
        CanonicalCqlStore.MembershipMutationResult result =
                store.tryRemoveConversationMember(conversationId, actorId);
        if (result == CanonicalCqlStore.MembershipMutationResult.OWNER_PROTECTED) {
            throw new ConflictException("transfer ownership before leaving the conversation");
        }
        if (result == CanonicalCqlStore.MembershipMutationResult.NOT_MEMBER) {
            adminConversationDirectory.index(getConversation(conversationId));
            return;
        }
        adminConversationDirectory.index(getConversation(conversationId));
        appendAudit(actorId, conversationId, "MEMBER_LEFT", "conversation", conversationId.toString(), actorId, null);
    }

    public void pinConversation(UUID actorId, UUID conversationId) {
        requireMember(conversationId, actorId);
        for (int pin = 0; pin < 3; pin++) {
            if (store.tryPinConversation(actorId, conversationId, pin)) {
                appendAudit(actorId, conversationId, "CONVERSATION_PIN", "conversation", conversationId.toString(), null, null);
                return;
            }
        }
        throw new BadRequestException("Pin limit reached");
    }

    public void unpinConversation(UUID actorId, UUID conversationId) {
        requireMember(conversationId, actorId);
        if (store.unpinConversation(actorId, conversationId)) {
            appendAudit(actorId, conversationId, "CONVERSATION_UNPIN", "conversation", conversationId.toString(), null, null);
        }
    }

    public void updateConversationChatPolicy(
            UUID actorId,
            UUID conversationId,
            CanonicalApiContracts.ConversationChatPolicyRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROOM_UPDATE);
        if (req == null || !StringUtils.hasText(req.chatMode()) || req.slowModeSeconds() == null) {
            throw new BadRequestException("chatMode and slowModeSeconds are required");
        }
        String chatMode = req.chatMode().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("OPEN", "READ_ONLY", "MANAGERS_ONLY").contains(chatMode)) {
            throw new BadRequestException("chatMode must be OPEN, READ_ONLY, or MANAGERS_ONLY");
        }
        int slowModeSeconds = req.slowModeSeconds();
        if (slowModeSeconds < 0 || slowModeSeconds > 86_400) {
            throw new BadRequestException("slowModeSeconds must be between 0 and 86400");
        }
        CanonicalConversation current = getConversation(conversationId);
        if (current.chatMode() == null || current.slowModeSeconds() == null) {
            throw new IllegalStateException("conversation chat policy is missing");
        }
        if (chatMode.equals(current.chatMode()) && slowModeSeconds == current.slowModeSeconds()) {
            adminConversationDirectory.updateChatPolicy(conversationId, chatMode, slowModeSeconds);
            return;
        }
        store.updateConversationChatPolicy(conversationId, chatMode, slowModeSeconds, Instant.now());
        adminConversationDirectory.updateChatPolicy(conversationId, chatMode, slowModeSeconds);
        appendAudit(actorId, conversationId, "CONVERSATION_CHAT_POLICY_UPDATE", "conversation",
                conversationId.toString(), null, null,
                Map.of("chatMode", current.chatMode(),
                        "slowModeSeconds", Integer.toString(current.slowModeSeconds())),
                Map.of("chatMode", chatMode,
                        "slowModeSeconds", Integer.toString(slowModeSeconds)));
    }

    public void updateConversationNotificationPolicy(
            UUID actorId,
            UUID conversationId,
            CanonicalApiContracts.ConversationNotificationPolicyRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROOM_UPDATE);
        if (req == null) {
            throw new BadRequestException("defaultNotificationLevel is required");
        }
        String nextLevel = NotificationSettingsPolicy.requireRoomLevel(req.defaultNotificationLevel());
        CanonicalConversation conversation = getConversation(conversationId);
        String previousLevel = NotificationSettingsPolicy.requireRoomLevel(conversation.defaultNotificationLevel());
        if (previousLevel.equals(nextLevel)) {
            return;
        }
        NotificationSettingsPolicy.requireRoomReduction(previousLevel, nextLevel);
        store.updateConversationNotificationPolicy(conversationId, nextLevel, Instant.now());
        appendAudit(actorId, conversationId, "CONVERSATION_NOTIFICATION_POLICY_UPDATE", "conversation",
                conversationId.toString(), null, null,
                Map.of("defaultNotificationLevel", previousLevel),
                Map.of("defaultNotificationLevel", nextLevel));
    }

    public void updateMemberNotificationPolicy(
            UUID actorId,
            UUID conversationId,
            UUID userId,
            CanonicalApiContracts.MemberNotificationPolicyRequest req) {
        authorization.requireMember(conversationId, actorId);
        if (!actorId.equals(userId)) {
            throw new ForbiddenException("members can only change their own notification override");
        }
        if (req == null) {
            throw new BadRequestException("notificationOverride is required");
        }
        String nextOverride = NotificationSettingsPolicy.requireOverride(req.notificationOverride());
        CanonicalConversationMember member = store.findConversationMember(conversationId, userId);
        if (member == null) {
            throw new NotFoundException("conversation member not found");
        }
        String previousOverride = NotificationSettingsPolicy.requireOverride(member.notificationOverride());
        if (previousOverride.equals(nextOverride)) {
            return;
        }
        store.updateMemberNotificationPolicy(conversationId, userId, nextOverride);
        appendAudit(actorId, conversationId, "MEMBER_NOTIFICATION_POLICY_UPDATE", "conversation_member",
                userId.toString(), userId, null,
                Map.of("notificationOverride", previousOverride),
                Map.of("notificationOverride", nextOverride));
    }

    public void updateMemberChatPolicy(
            UUID actorId,
            UUID conversationId,
            UUID userId,
            CanonicalApiContracts.MemberChatPolicyRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_MUTE);
        if (req == null || !StringUtils.hasText(req.reason())) {
            throw new BadRequestException("reason is required for member chat policy changes");
        }
        CanonicalConversation conversation = getConversation(conversationId);
        if (userId.equals(conversation.ownerId())) {
            throw new ConflictException("conversation owner cannot be muted or rate limited");
        }
        CanonicalConversationMember member = store.findConversationMember(conversationId, userId);
        if (member == null) {
            throw new NotFoundException("conversation member not found");
        }
        Integer interval = req.messageIntervalSeconds();
        if (interval != null && (interval < 0 || interval > 604_800)) {
            throw new BadRequestException("messageIntervalSeconds must be between 0 and 604800");
        }
        if (req.mutedUntil() != null && !req.mutedUntil().isAfter(Instant.now())) {
            throw new BadRequestException("mutedUntil must be in the future or null");
        }
        if (Objects.equals(member.mutedUntil(), req.mutedUntil())
                && Objects.equals(member.messageIntervalSeconds(), interval)) {
            return;
        }
        store.updateMemberChatPolicy(conversationId, userId, req.mutedUntil(), interval);
        appendAudit(actorId, conversationId, "MEMBER_CHAT_POLICY_UPDATE", "conversation_member",
                userId.toString(), userId, req.reason().trim(),
                Map.of("mutedUntil", String.valueOf(member.mutedUntil()),
                        "messageIntervalSeconds", String.valueOf(member.messageIntervalSeconds())),
                Map.of("mutedUntil", String.valueOf(req.mutedUntil()),
                        "messageIntervalSeconds", String.valueOf(interval)));
    }

    private void requireMember(UUID conversationId, UUID userId) {
        if (store.findConversationMember(conversationId, userId) == null) {
            throw new ForbiddenException("not member of conversation");
        }
    }

    private Set<UUID> createSystemConversationRoles(UUID conversationId, UUID actorId, Instant now) {
        conversationRepository.initializeRoleCatalog(conversationId);
        UUID ownerRoleId = UUID.randomUUID();
        UUID memberRoleId = UUID.randomUUID();
        conversationRepository.saveSystemRole(new ConversationRole(
                conversationId,
                10_000,
                ownerRoleId,
                "OWNER",
                "Owner",
                "#F59E0B",
                EnumSet.allOf(ConversationPermission.class),
                false,
                true,
                actorId,
                now,
                now));
        conversationRepository.saveSystemRole(new ConversationRole(
                conversationId,
                1,
                memberRoleId,
                "MEMBER",
                "Member",
                "#64748B",
                EnumSet.of(
                        ConversationPermission.MESSAGE_SEND,
                        ConversationPermission.MESSAGE_EDIT_OWN,
                        ConversationPermission.MESSAGE_DELETE_OWN,
                        ConversationPermission.POLL_CREATE,
                        ConversationPermission.CALL_START),
                true,
                true,
                actorId,
                now,
                now));
        return Set.of(ownerRoleId);
    }

    private Set<UUID> defaultRoleIds(UUID conversationId) {
        return conversationRepository.findRoles(conversationId).stream()
                .filter(ConversationRole::isDefault)
                .map(ConversationRole::roleId)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private void repairMembershipProjections(CanonicalConversationMember member) {
        CanonicalConversation conversation = getConversation(member.conversationId());
        store.addConversationMembershipProjection(member.userId(), conversation, member);
        adminConversationDirectory.index(conversation);
        store.indexCommunityConversation(conversation);
    }

    private void requireMemberOfAnyConversation(UUID userId) {
        if (!StringUtils.hasText(userId.toString())) {
            throw new ForbiddenException("auth required");
        }
    }

    private void requireUser(UUID userId) {
        if (userId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    private void appendAudit(UUID actorId, UUID conversationId, String action, String resourceType, String resourceId, UUID targetUserId, String reason) {
        appendAudit(actorId, conversationId, action, resourceType, resourceId, targetUserId, reason,
                Map.of(), Map.of());
    }

    private void appendAudit(
            UUID actorId,
            UUID conversationId,
            String action,
            String resourceType,
            String resourceId,
            UUID targetUserId,
            String reason,
            Map<String, String> beforeState,
            Map<String, String> afterState) {
        eventRecorder.record(
                actorId,
                conversationId,
                action,
                resourceType,
                resourceId,
                targetUserId,
                reason,
                beforeState,
                afterState);
    }

    private String normalize(String input) {
        return StringUtils.hasText(input) ? input.trim().toLowerCase(Locale.ROOT) : "";
    }

    private String normalize(String input, String defaultValue) {
        return StringUtils.hasText(input) ? input.trim() : defaultValue;
    }

    private String defaultConversationName(String type) {
        return "DM".equalsIgnoreCase(type) ? "Direct Message" : "Conversation";
    }

    private String buildDmPairKey(UUID userA, UUID userB) {
        String a = userA.toString();
        String b = userB.toString();
        return a.compareTo(b) <= 0 ? a + ":" + b : b + ":" + a;
    }
}
