package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.chatapp.chat_service.canonical.model.MessageBucket;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.notification.NotificationSettingsPolicy;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CanonicalBackendService {

    private final CanonicalCqlStore store;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final CanonicalConversationRepository conversationRepository;
    private final ConversationAuthorizationService authorization;
    private final CanonicalEventRecorder eventRecorder;
    private final ChatPolicyService chatPolicy;
    private final SimpMessagingTemplate messaging;
    private final AdminConversationDirectoryRepository adminConversationDirectory;

    @Autowired
    public CanonicalBackendService(
            CanonicalCqlStore store,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider,
            CanonicalConversationRepository conversationRepository,
            ConversationAuthorizationService authorization,
            CanonicalEventRecorder eventRecorder,
            ChatPolicyService chatPolicy,
            SimpMessagingTemplate messaging,
            AdminConversationDirectoryRepository adminConversationDirectory) {
        this.store = store;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.conversationRepository = conversationRepository;
        this.authorization = authorization;
        this.eventRecorder = eventRecorder;
        this.chatPolicy = chatPolicy;
        this.messaging = messaging;
        this.adminConversationDirectory = adminConversationDirectory;
    }

    public CanonicalApiContracts.UserResponse register(CanonicalApiContracts.RegisterRequest req) {
        Instant now = Instant.now();
        String username = req.username();
        String email = req.email();
        if (!StringUtils.hasText(username) || !StringUtils.hasText(email)) {
            throw new BadRequestException("username and email are required");
        }
        if (!StringUtils.hasText(req.password()) || req.password().length() < 8) {
            throw new BadRequestException("password must have at least 8 chars");
        }

        String normUsername = normalize(username);
        String normEmail = normalize(email);
        UUID userId = UUID.randomUUID();
        if (!store.claimUsername(normUsername, userId, now)) {
            throw new ConflictException("username already exists");
        }
        if (!store.claimEmail(normEmail, userId, now)) {
            throw new ConflictException("email already exists");
        }

        CanonicalUser user = new CqlCanonicalRecords.CanonicalUser(
                userId,
                username.trim(),
                normUsername,
                email.trim(),
                normEmail,
                passwordEncoder.encode(req.password()),
                normalize(req.authProvider(), "LOCAL").toUpperCase(Locale.ROOT),
                null,
                req.displayName(),
                null,
                "ACTIVE",
                now,
                now,
                null
        );
        store.saveUser(user);
        return toUserResponse(user);
    }

    public CanonicalApiContracts.AuthResponse login(CanonicalApiContracts.LoginRequest req) {
        if (!StringUtils.hasText(req.username()) || !StringUtils.hasText(req.password())) {
            throw new BadRequestException("username/password required");
        }
        CanonicalUser user = store.findUserByUsername(normalize(req.username()));
        if (user == null || !passwordEncoder.matches(req.password(), user.passwordHash())) {
            throw new ForbiddenException("invalid credentials");
        }
        if (!"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw new ForbiddenException("account is not active");
        }
        String accessToken = tokenProvider.generateToken(user.username(), user.userId());
        return new CanonicalApiContracts.AuthResponse(accessToken, toUserResponse(user));
    }

    public CanonicalApiContracts.UserResponse me(UUID userId) {
        CanonicalUser user = store.findUserById(userId);
        if (user == null) {
            throw new NotFoundException("user not found");
        }
        return toUserResponse(user);
    }

    public CanonicalApiContracts.PublicUserResponse getPublicUser(UUID actorId, UUID userId) {
        requireAuthenticatedActor(actorId);
        CanonicalUser user = store.findUserById(userId);
        if (user == null || !"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw new NotFoundException("user not found");
        }
        return toPublicUserResponse(user);
    }

    public CanonicalApiContracts.UserSearchPage searchUsers(
            UUID actorId,
            String rawQuery,
            int requestedLimit,
            String cursor) {
        requireAuthenticatedActor(actorId);
        String query = normalize(rawQuery);
        if (query.length() < 2) {
            throw new BadRequestException("search query must contain at least 2 characters");
        }
        String prefix = query.substring(0, Math.min(20, query.length()));
        int limit = Math.max(1, Math.min(50, requestedLimit));
        UserCursor decoded = decodeUserCursor(cursor);
        var rows = store.searchUsersByPrefix(
                prefix,
                decoded == null ? null : decoded.usernameNormalized(),
                decoded == null ? null : decoded.userId(),
                limit + 1);
        boolean hasNext = rows.size() > limit;
        var pageRows = hasNext ? rows.subList(0, limit) : rows;
        var content = pageRows.stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(row.accountStatus()))
                .map(row -> new CanonicalApiContracts.PublicUserResponse(
                        row.userId(), row.username(), row.displayName(), row.avatarUrl(), row.accountStatus()))
                .toList();
        String nextCursor = hasNext ? encodeUserCursor(pageRows.get(pageRows.size() - 1)) : null;
        return new CanonicalApiContracts.UserSearchPage(content, nextCursor, hasNext);
    }

    public CanonicalApiContracts.UserResponse updateProfile(
            UUID actorId,
            CanonicalApiContracts.UpdateProfileRequest request) {
        requireAuthenticatedActor(actorId);
        String displayName = request.displayName().trim();
        CanonicalUser current = store.findUserById(actorId);
        if (current == null) {
            throw new NotFoundException("user not found");
        }
        CanonicalUser updated = store.updateUserProfile(actorId, displayName, request.avatarUrl(), Instant.now());
        eventRecorder.record(
                actorId,
                null,
                "USER_PROFILE_UPDATE",
                "user",
                actorId.toString(),
                actorId,
                null,
                Map.of("displayName", current.displayName()),
                Map.of("displayName", updated.displayName()));
        return toUserResponse(updated);
    }

    private void requireAuthenticatedActor(UUID actorId) {
        if (actorId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    private String encodeUserCursor(CanonicalCqlStore.UserDirectoryRow row) {
        String value = row.usernameNormalized() + "|" + row.userId();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private UserCursor decodeUserCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = value.lastIndexOf('|');
            if (separator <= 0 || separator == value.length() - 1) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new UserCursor(value.substring(0, separator), UUID.fromString(value.substring(separator + 1)));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("invalid user search cursor");
        }
    }

    private record UserCursor(String usernameNormalized, UUID userId) {
    }

    private CanonicalApiContracts.UserResponse toUserResponse(CanonicalUser user) {
        return new CanonicalApiContracts.UserResponse(
                user.userId(),
                user.username(),
                user.email(),
                user.displayName(),
                user.avatarUrl(),
                user.accountStatus(),
                user.createdAt(),
                user.lastLoginAt());
    }

    private CanonicalApiContracts.PublicUserResponse toPublicUserResponse(CanonicalUser user) {
        return new CanonicalApiContracts.PublicUserResponse(
                user.userId(), user.username(), user.displayName(), user.avatarUrl(), user.accountStatus());
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
            String pairKey = buildDmPairKey(actorId, conversationBucketUser);
            UUID existed = store.findDmPair(pairKey);
            if (existed != null) {
                CanonicalConversation existedConv = store.findConversation(existed);
                if (existedConv != null) {
                    return existedConv;
                }
            }
            UUID winner = store.claimDmPair(pairKey, conversationId, now);
            if (!conversationId.equals(winner)) {
                CanonicalConversation existing = store.findConversation(winner);
                if (existing != null) {
                    return existing;
                }
                throw new ConflictException("direct message creation is already in progress; retry");
            }
        }

        if (requestedMemberIds.size() + 1 > maxMembers) {
            throw new BadRequestException("initial members exceed maxMembers");
        }
        for (UUID memberId : requestedMemberIds) {
            CanonicalUser memberUser = store.findUserById(memberId);
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
        adminConversationDirectory.index(conversation);

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
        store.upsertConversationMember(owner);
        store.addConversationMembershipProjection(actorId, conversation, owner);

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
            store.upsertConversationMember(peer);
            store.addConversationMembershipProjection(memberId, conversation, peer);
        }

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

    public List<CanonicalApiContracts.ConversationMemberView> listConversationMembers(
            UUID actorId, UUID conversationId, int requestedLimit) {
        requireMember(conversationId, actorId);
        CanonicalConversation conversation = getConversation(conversationId);
        int limit = Math.max(1, Math.min(500, requestedLimit));
        return store.listConversationMembers(conversationId, limit).stream()
                .map(member -> {
                    CanonicalUser user = store.findUserById(member.userId());
                    if (user == null) {
                        throw new IllegalStateException("conversation member references a missing user");
                    }
                    return new CanonicalApiContracts.ConversationMemberView(
                            member.userId(),
                            member.conversationId(),
                            member.userId().equals(conversation.ownerId()) ? "owner" : "member",
                            member.joinedAt(),
                            user.username(),
                            user.displayName(),
                            user.avatarUrl());
                })
                .toList();
    }

    public List<CanonicalApiContracts.ConversationListItem> listMyConversations(UUID actorId, int limit) {
        return store.listConversationProjectionByUser(actorId, Math.max(10, Math.min(100, limit))).stream()
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
    }

    public void addMember(UUID actorId, UUID conversationId, CanonicalApiContracts.ConversationMemberRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_INVITE);
        CanonicalConversation conversation = getConversation(conversationId);
        if ("DM".equals(conversation.conversationType())) {
            throw new BadRequestException("direct messages cannot add extra members");
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
        store.upsertConversationMember(member);
        store.addConversationMembershipProjection(req.userId(), conversation, member);
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
        store.removeConversationMember(conversationId, removedUserId);
        appendAudit(actorId, conversationId, "MEMBER_REMOVE", "conversation", conversationId.toString(), removedUserId, "removed");
    }

    public void leaveConversation(UUID actorId, UUID conversationId) {
        authorization.requireMember(conversationId, actorId);
        CanonicalConversation conversation = getConversation(conversationId);
        if (actorId.equals(conversation.ownerId())) {
            throw new ConflictException("transfer ownership before leaving the conversation");
        }
        store.removeConversationMember(conversationId, actorId);
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

    public CanonicalMessage sendMessage(UUID actorId, UUID conversationId, CanonicalApiContracts.MessageSendRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_SEND);
        if (req == null || req.clientMessageId() == null) {
            throw new BadRequestException("clientMessageId is required");
        }
        if (!StringUtils.hasText(req.messageType())) {
            throw new BadRequestException("messageType is required");
        }
        if (req.content() == null) {
            throw new BadRequestException("content is required");
        }
        if (!StringUtils.hasText(req.contentFormat())) {
            throw new BadRequestException("contentFormat is required");
        }
        String messageType = req.messageType().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO", "STICKER", "POLL", "SYSTEM")
                .contains(messageType)) {
            throw new BadRequestException("unsupported messageType");
        }
        CanonicalConversation conversation = getConversation(conversationId);
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            throw new ConflictException("archived conversations do not accept new messages");
        }
        CanonicalConversationMember member = authorization.requireMember(conversationId, actorId);
        chatPolicy.enforceSend(
                conversation,
                member,
                authorization.effectivePermissions(conversationId, actorId),
                req.clientMessageId());

        Instant now = Instant.now();
        UUID clientMessageId = req.clientMessageId();
        String requestedBucket = MessageBucket.forWrite(now, clientMessageId);
        var claim = store.claimMessage(
                actorId,
                clientMessageId,
                conversationId,
                requestedBucket,
                MessageRequestFingerprint.sha256(req),
                now);
        if (claim == null) {
            throw new ConflictException("message idempotency claim failed; retry with the same clientMessageId");
        }
        if (!claim.matchesRequest()) {
            throw new ConflictException("clientMessageId was already used for a different message");
        }
        if (!claim.claimed()) {
            CanonicalMessage existing = store.findMessage(conversationId, claim.messageBucket(), claim.messageId());
            if (existing != null) {
                store.recordMessageBucket(existing);
                return existing;
            }
        }

        String bucket = claim.messageBucket();
        UUID assignedMessageId = claim.messageId();
        Instant createdAt = claim.createdAt();

        CanonicalMessage message = new CqlCanonicalRecords.CanonicalMessage(
                conversationId,
                bucket,
                assignedMessageId,
                actorId,
                messageType,
                req.content(),
                req.contentFormat().trim().toUpperCase(Locale.ROOT),
                req.replyToMessageId(),
                req.replyToSenderId(),
                req.stickerId(),
                req.pollId(),
                null,
                req.forwardedFromConversationId(),
                req.forwardedFromMessageBucket(),
                req.forwardedFromMessageId(),
                false,
                null,
                null,
                null,
                req.attachments() != null && !req.attachments().isEmpty(),
                req.mentionedUserIds() != null && !req.mentionedUserIds().isEmpty(),
                false,
                createdAt,
                clientMessageId
        );
        store.insertMessage(message, bucket);
        if (req.attachments() != null) {
            for (var attach : req.attachments()) {
                store.addMessageAttachment(message, attach);
                publishConversationEvent(message.conversationId(), "/attachments", Map.of(
                        "messageId", message.messageId().toString(),
                        "messageBucket", message.messageBucket(),
                        "attachment", attach,
                        "addedBy", actorId.toString()));
            }
        }
        if (req.mentionedUserIds() != null && !req.mentionedUserIds().isEmpty()) {
            store.upsertMentions(message, req.mentionedUserIds());
        }
        if (claim.claimed()) {
            CanonicalUser sender = store.findUserById(actorId);
            if (sender == null) {
                throw new IllegalStateException("authenticated sender does not exist");
            }
            store.updateLastMessageProjections(
                    message,
                    sender.displayName(),
                    conversationRepository.findMembers(conversationId));
            recordMessageEvent(actorId, "MESSAGE_SEND", message, req.mentionedUserIds());
            notifyConversationMembers(actorId, message, sender, conversationRepository.findMembers(conversationId), req.mentionedUserIds());
        }
        return message;
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
        store.updateConversationChatPolicy(conversationId, chatMode, slowModeSeconds, Instant.now());
        appendAudit(actorId, conversationId, "CONVERSATION_CHAT_POLICY_UPDATE", "conversation",
                conversationId.toString(), null, null);
    }

    public void updateMemberChatPolicy(
            UUID actorId,
            UUID conversationId,
            UUID userId,
            CanonicalApiContracts.MemberChatPolicyRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_MUTE);
        if (store.findConversationMember(conversationId, userId) == null) {
            throw new NotFoundException("conversation member not found");
        }
        Integer interval = req.messageIntervalSeconds();
        if (interval != null && (interval < 0 || interval > 604_800)) {
            throw new BadRequestException("messageIntervalSeconds must be between 0 and 604800");
        }
        store.updateMemberChatPolicy(conversationId, userId, req.mutedUntil(), interval);
        appendAudit(actorId, conversationId, "MEMBER_CHAT_POLICY_UPDATE", "conversation_member",
                userId.toString(), userId, req.reason());
    }

    public CanonicalMessage editMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId, CanonicalApiContracts.MessageUpdateRequest req) {
        CanonicalMessage message = store.findMessage(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (!StringUtils.hasText(req.content()) || req.content().length() > 20_000) {
            throw new BadRequestException("message content is required and must not exceed 20000 characters");
        }
        if (Boolean.TRUE.equals(message.isDeleted())) {
            throw new ConflictException("deleted messages cannot be edited");
        }
        if (!message.senderId().equals(actorId)) {
            throw new ForbiddenException("only sender can edit");
        }
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_EDIT_OWN);
        if (!store.updateMessageContent(conversationId, bucket, messageId, req.content(), actorId)) {
            throw new ConflictException("message changed concurrently; reload and retry");
        }
        CanonicalMessage updated = store.findMessage(conversationId, bucket, messageId);
        recordMessageEvent(actorId, "MESSAGE_EDIT", updated, null);
        return updated;
    }

    public CanonicalMessage deleteMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        CanonicalMessage message = store.findMessage(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (!message.senderId().equals(actorId)) {
            throw new ForbiddenException("only sender can delete");
        }
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_DELETE_OWN);
        if (Boolean.TRUE.equals(message.isDeleted())) {
            return message;
        }
        if (!store.deleteMessage(conversationId, bucket, messageId, actorId)) {
            throw new ConflictException("message changed concurrently; reload and retry");
        }
        CanonicalMessage deleted = store.findMessage(conversationId, bucket, messageId);
        recordMessageEvent(actorId, "MESSAGE_DELETE", deleted, null);
        return deleted;
    }

    public void reaction(UUID actorId, UUID conversationId, String bucket, UUID messageId, CanonicalApiContracts.MessageReactionRequest req) {
        requireMember(conversationId, actorId);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        if (!StringUtils.hasText(req.emoji()) || req.emoji().codePointCount(0, req.emoji().length()) > 8) {
            throw new BadRequestException("emoji is required and must contain at most 8 code points");
        }
        if (store.addReaction(conversationId, bucket, messageId, actorId, req.emoji())) {
            appendAudit(actorId, conversationId, "MESSAGE_REACTION_ADD", "message", messageId.toString(), null, null);
            publishConversationEvent(conversationId, "/reactions", Map.of(
                    "messageId", messageId.toString(), "messageBucket", bucket,
                    "emoji", req.emoji(), "userId", actorId.toString(), "action", "ADD"));
        }
    }

    public void removeReaction(
            UUID actorId, UUID conversationId, String bucket, UUID messageId, String emoji) {
        requireMember(conversationId, actorId);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        if (!StringUtils.hasText(emoji) || emoji.codePointCount(0, emoji.length()) > 8) {
            throw new BadRequestException("emoji is required and must contain at most 8 code points");
        }
        if (store.removeReaction(conversationId, bucket, messageId, actorId, emoji)) {
            appendAudit(actorId, conversationId, "MESSAGE_REACTION_REMOVE", "message", messageId.toString(), null, null);
            publishConversationEvent(conversationId, "/reactions", Map.of(
                    "messageId", messageId.toString(), "messageBucket", bucket,
                    "emoji", emoji, "userId", actorId.toString(), "action", "REMOVE"));
        }
    }

    public void pinMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_PIN);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        if (!store.pinMessage(conversationId, bucket, messageId, actorId, true)) {
            throw new ConflictException("a conversation can have at most 5 pinned messages");
        }
        appendAudit(actorId, conversationId, "MESSAGE_PIN", "message", messageId.toString(), null, null);
        publishConversationEvent(conversationId, "/pins", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "pinnedBy", actorId.toString(), "action", "PIN"));
    }

    public void unpinMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_PIN);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        store.pinMessage(conversationId, bucket, messageId, actorId, false);
        appendAudit(actorId, conversationId, "MESSAGE_UNPIN", "message", messageId.toString(), null, null);
        publishConversationEvent(conversationId, "/pins", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "pinnedBy", actorId.toString(), "action", "UNPIN"));
    }

    public CanonicalMessage getMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        requireMember(conversationId, actorId);
        CanonicalMessage message = store.findMessage(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        return message;
    }

    public List<CanonicalMessage> listMessages(UUID actorId, UUID conversationId, String bucket, int limit) {
        requireMember(conversationId, actorId);
        return store.listMessagesByBucket(conversationId, bucket, Math.max(1, Math.min(100, limit)));
    }

    public CanonicalApiContracts.MessagePage listMessageHistory(
            UUID actorId,
            UUID conversationId,
            int requestedLimit,
            String cursor) {
        requireMember(conversationId, actorId);
        int limit = Math.max(1, Math.min(100, requestedLimit));
        MessageCursor decoded = decodeMessageCursor(cursor);
        Instant cursorHour = decoded == null ? null : decoded.createdAt().truncatedTo(ChronoUnit.HOURS);
        List<CanonicalCqlStore.MessageBucketRow> buckets = store.listMessageBuckets(
                conversationId, cursorHour, 256);
        List<CanonicalMessage> candidates = new ArrayList<>();
        for (CanonicalCqlStore.MessageBucketRow bucket : buckets) {
            boolean cursorBucketHour = decoded != null && bucket.bucketHour().equals(cursorHour);
            List<CanonicalMessage> messages = cursorBucketHour
                    ? store.listMessagesByBucketBefore(
                            conversationId, bucket.messageBucket(), decoded.messageId(), limit + 1)
                    : store.listMessagesByBucket(conversationId, bucket.messageBucket(), limit + 1);
            candidates.addAll(messages);
        }
        candidates.sort(Comparator
                .comparing(CanonicalMessage::createdAt)
                .thenComparingLong(message -> Uuids.unixTimestamp(message.messageId()))
                .reversed());
        boolean hasNext = candidates.size() > limit || buckets.size() == 256;
        List<CanonicalMessage> content = candidates.size() > limit
                ? List.copyOf(candidates.subList(0, limit))
                : List.copyOf(candidates);
        String nextCursor = hasNext && !content.isEmpty()
                ? encodeMessageCursor(content.get(content.size() - 1))
                : null;
        return new CanonicalApiContracts.MessagePage(content, nextCursor, hasNext && nextCursor != null);
    }

    private String encodeMessageCursor(CanonicalMessage message) {
        String value = message.createdAt().toEpochMilli() + "|" + message.messageId();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private MessageCursor decodeMessageCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = value.indexOf('|');
            if (separator <= 0 || separator == value.length() - 1) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new MessageCursor(
                    Instant.ofEpochMilli(Long.parseLong(value.substring(0, separator))),
                    UUID.fromString(value.substring(separator + 1)));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("invalid message cursor");
        }
    }

    private record MessageCursor(Instant createdAt, UUID messageId) {
    }

    public void markMessageRead(
            UUID actorId,
            UUID conversationId,
            String bucket,
            UUID messageId) {
        CanonicalConversationMember member = store.findConversationMember(conversationId, actorId);
        if (member == null) {
            throw new ForbiddenException("not member of conversation");
        }
        CanonicalMessage message = store.findMessage(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (member.lastReadMessageId() != null
                && Uuids.unixTimestamp(member.lastReadMessageId()) >= Uuids.unixTimestamp(messageId)) {
            return;
        }
        store.markMessageRead(conversationId, bucket, messageId, actorId, Instant.now());
        publishConversationEvent(conversationId, "/read", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "readerId", actorId.toString(), "readAt", Instant.now().toString()));
    }

    public List<CanonicalApiContracts.MessageReadReceiptView> listMessageReadReceipts(
            UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        requireMember(conversationId, actorId);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        return store.listMessageReadReceipts(conversationId, bucket, messageId);
    }

    public List<CanonicalApiContracts.MessageRevisionView> listMessageRevisions(
            UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        requireMember(conversationId, actorId);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        return store.listMessageRevisions(conversationId, bucket, messageId);
    }

    public CanonicalApiContracts.PollView createPoll(UUID actorId, CanonicalApiContracts.PollCreateRequest req) {
        authorization.requirePermission(req.conversationId(), actorId, ConversationPermission.POLL_CREATE);
        if (req.clientMessageId() == null) {
            throw new BadRequestException("clientMessageId is required");
        }
        if (!StringUtils.hasText(req.question()) || req.question().trim().length() > 500) {
            throw new BadRequestException("poll question is required and must not exceed 500 characters");
        }
        if (req.options() == null || req.options().size() < 2 || req.options().size() > 10
                || req.options().stream().anyMatch(option -> !StringUtils.hasText(option) || option.trim().length() > 200)) {
            throw new BadRequestException("poll must have 2 to 10 non-empty options of at most 200 characters");
        }
        if (req.options().stream().map(option -> option.trim().toLowerCase(Locale.ROOT)).distinct().count()
                != req.options().size()) {
            throw new BadRequestException("poll options must be unique");
        }
        if (req.closesAt() != null && !req.closesAt().isAfter(Instant.now())) {
            throw new BadRequestException("poll closesAt must be in the future");
        }
        UUID pollId = UUID.randomUUID();
        CanonicalMessage pollMessage = sendMessage(actorId, req.conversationId(),
                new CanonicalApiContracts.MessageSendRequest(
                        req.clientMessageId(), "POLL", req.question().trim(), "PLAIN",
                        null, null, null, pollId, null, null, null, List.of(), Set.of()));
        CanonicalPoll poll = new CqlCanonicalRecords.CanonicalPoll(
                pollId,
                req.conversationId(),
                pollMessage.messageBucket(),
                pollMessage.messageId(),
                req.question().trim(),
                req.options().stream().map(String::trim).toList(),
                Boolean.TRUE.equals(req.isMultipleChoice()),
                Boolean.TRUE.equals(req.isAnonymous()),
                false,
                actorId,
                Instant.now(),
                req.closesAt(),
                null,
                null,
                Map.of()
        );
        store.createPoll(poll);
        appendAudit(actorId, req.conversationId(), "POLL_CREATE", "poll", poll.pollId().toString(), null, null);
        return pollView(actorId, poll);
    }

    public CanonicalApiContracts.PollView getPoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requirePoll(actorId, pollId);
        return pollView(actorId, poll);
    }

    public CanonicalApiContracts.PollView votePoll(
            UUID actorId, UUID pollId, CanonicalApiContracts.PollVoteRequest req) {
        CanonicalPoll poll = requireOpenPoll(actorId, pollId);
        Set<Integer> selected = req.selectedOptionIndexes();
        if (selected == null || selected.isEmpty()) {
            throw new BadRequestException("at least one poll option is required");
        }
        if (!Boolean.TRUE.equals(poll.isMultipleChoice()) && selected.size() != 1) {
            throw new BadRequestException("this poll allows exactly one option");
        }
        if (selected.stream().anyMatch(index -> index == null || index < 0 || index >= poll.options().size())) {
            throw new BadRequestException("poll option index is out of range");
        }
        var result = store.votePoll(pollId, actorId, selected);
        if (result == CanonicalCqlStore.VoteResult.CONFLICT) {
            throw new ConflictException("vote changed concurrently; reload the poll and retry");
        }
        if (result == CanonicalCqlStore.VoteResult.CREATED || result == CanonicalCqlStore.VoteResult.UPDATED) {
            appendAudit(actorId, poll.conversationId(),
                    result == CanonicalCqlStore.VoteResult.CREATED ? "POLL_VOTE" : "POLL_VOTE_CHANGE",
                    "poll", pollId.toString(), actorId, null);
        }
        return pollView(actorId, poll);
    }

    public CanonicalApiContracts.PollView removePollVote(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requireOpenPoll(actorId, pollId);
        var result = store.removePollVote(pollId, actorId);
        if (result == CanonicalCqlStore.VoteResult.CONFLICT) {
            throw new ConflictException("vote changed concurrently; reload the poll and retry");
        }
        if (result == CanonicalCqlStore.VoteResult.REMOVED) {
            appendAudit(actorId, poll.conversationId(), "POLL_VOTE_REMOVE", "poll", pollId.toString(), actorId, null);
        }
        return pollView(actorId, poll);
    }

    public CanonicalApiContracts.PollView closePoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requirePoll(actorId, pollId);
        if (!actorId.equals(poll.createdBy())
                && !authorization.effectivePermissions(poll.conversationId(), actorId)
                .contains(ConversationPermission.POLL_MANAGE)) {
            throw new ForbiddenException("only the poll creator or a poll manager can close this poll");
        }
        if (!Boolean.TRUE.equals(poll.isClosed()) && store.closePoll(poll, actorId, Instant.now())) {
            appendAudit(actorId, poll.conversationId(), "POLL_CLOSE", "poll", pollId.toString(), null, null);
        }
        return pollView(actorId, requirePoll(actorId, pollId));
    }

    private CanonicalPoll requirePoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = store.findPollById(pollId);
        if (poll == null) {
            throw new NotFoundException("poll not found");
        }
        requireMember(poll.conversationId(), actorId);
        return poll;
    }

    private CanonicalPoll requireOpenPoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requirePoll(actorId, pollId);
        if (Boolean.TRUE.equals(poll.isClosed())
                || poll.closesAt() != null && !poll.closesAt().isAfter(Instant.now())) {
            throw new ConflictException("poll is closed");
        }
        return poll;
    }

    private CanonicalApiContracts.PollView pollView(UUID actorId, CanonicalPoll poll) {
        Map<UUID, Set<Integer>> votes = store.listPollVotes(poll.pollId());
        Map<Integer, Set<UUID>> votersByOption = new LinkedHashMap<>();
        if (!Boolean.TRUE.equals(poll.isAnonymous())) {
            for (int index = 0; index < poll.options().size(); index++) {
                votersByOption.put(index, new HashSet<>());
            }
            votes.forEach((voterId, indexes) -> indexes.forEach(index ->
                    votersByOption.computeIfAbsent(index, ignored -> new HashSet<>()).add(voterId)));
        }
        return new CanonicalApiContracts.PollView(
                poll,
                store.getPollOptionCounts(poll.pollId()),
                votes.getOrDefault(actorId, Set.of()),
                votes.size(),
                votersByOption);
    }

    @Value("${app.public-base-url:http://localhost:5173}")
    private String publicBaseUrl;

    public CanonicalApiContracts.InviteLinkView createInvite(
            UUID actorId, CanonicalApiContracts.InviteLinkCreateRequest req) {
        authorization.requirePermission(req.conversationId(), actorId, ConversationPermission.INVITE_MANAGE);
        String inviteKind = normalize(req.inviteKind(), "LINK").toUpperCase(Locale.ROOT);
        String joinPolicy = normalize(req.joinPolicy(), "DIRECT_JOIN").toUpperCase(Locale.ROOT);
        if (!Set.of("LINK", "QR").contains(inviteKind)) {
            throw new BadRequestException("inviteKind must be LINK or QR");
        }
        if (!Set.of("DIRECT_JOIN", "REQUEST_APPROVAL").contains(joinPolicy)) {
            throw new BadRequestException("joinPolicy must be DIRECT_JOIN or REQUEST_APPROVAL");
        }
        if (req.maxUses() != null && (req.maxUses() < 1 || req.maxUses() > 1_000_000)) {
            throw new BadRequestException("maxUses must be between 1 and 1000000");
        }
        Instant expiresAt = req.expiresAt();
        if (expiresAt == null && req.durationMinutes() != null) {
            if (req.durationMinutes() < 1 || req.durationMinutes() > 525_600) {
                throw new BadRequestException("durationMinutes must be between 1 and 525600");
            }
            expiresAt = Instant.now().plusSeconds(req.durationMinutes() * 60L);
        }
        if (expiresAt == null) {
            expiresAt = Instant.now().plusSeconds(7 * 24 * 3600L);
        }
        if (!expiresAt.isAfter(Instant.now())) {
            throw new BadRequestException("invite expiration must be in the future");
        }
        UUID linkId = com.datastax.oss.driver.api.core.uuid.Uuids.timeBased();
        String token = createInviteToken();
        CanonicalInviteLink invite = new CqlCanonicalRecords.CanonicalInviteLink(
                linkId,
                token,
                req.conversationId(),
                actorId,
                Instant.now(),
                inviteKind,
                joinPolicy,
                normalize(req.displayName(), "invite"),
                expiresAt,
                true,
                req.maxUses(),
                0,
                null,
                null
        );
        store.createInvite(invite);
        appendAudit(actorId, req.conversationId(), "INVITE_CREATE", "invite", linkId.toString(), null, null);
        return new CanonicalApiContracts.InviteLinkView(invite, joinUrl(token));
    }

    public List<CanonicalInviteLink> listInvite(UUID actorId, UUID conversationId, int limit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        return store.listInviteByConversation(conversationId, Math.max(1, Math.min(50, limit)));
    }

    public CanonicalApiContracts.InvitePreview previewInvite(String token) {
        CanonicalInviteLink invite = store.findInviteByToken(token);
        if (invite == null) {
            return new CanonicalApiContracts.InvitePreview(
                    "INVALID", null, null, null, null, null, null, null, null);
        }
        CanonicalConversation conversation = store.findConversation(invite.conversationId());
        int used = invite.usedCount() == null ? 0 : invite.usedCount();
        String status = inviteStatus(invite, used);
        Integer remaining = invite.maxUses() == null ? null : Math.max(0, invite.maxUses() - used);
        return new CanonicalApiContracts.InvitePreview(
                status, invite.conversationId(), conversation == null ? null : conversation.name(),
                conversation == null ? null : conversation.conversationType(), invite.createdBy(),
                invite.displayName(), invite.joinPolicy(), invite.expiresAt(), remaining);
    }

    public CanonicalApiContracts.InviteConsumeResponse consumeInvite(
            UUID actorId, CanonicalApiContracts.InviteConsumeRequest req) {
        CanonicalInviteLink invite = store.findInviteByToken(req.linkToken());
        if (invite == null) {
            return new CanonicalApiContracts.InviteConsumeResponse("INVALID", null);
        }
        String status = inviteStatus(invite, invite.usedCount() == null ? 0 : invite.usedCount());
        if (!"ACTIVE".equals(status)) {
            store.recordInviteOutcome(invite, actorId, status);
            return new CanonicalApiContracts.InviteConsumeResponse(status, invite.conversationId());
        }
        if (store.findConversationMember(invite.conversationId(), actorId) != null) {
            store.recordInviteOutcome(invite, actorId, "ALREADY_MEMBER");
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_MEMBER", invite.conversationId());
        }
        if ("REQUEST_APPROVAL".equals(invite.joinPolicy())) {
            String requestStatus = store.requestInviteApproval(invite, actorId);
            appendAudit(actorId, invite.conversationId(), "JOIN_REQUEST_CREATE", "invite", invite.linkId().toString(), null, null);
            return new CanonicalApiContracts.InviteConsumeResponse(requestStatus, invite.conversationId());
        }
        boolean used = store.consumeInvite(req.linkToken(), actorId);
        if (!used) {
            return new CanonicalApiContracts.InviteConsumeResponse("RETRY_REQUIRED", invite.conversationId());
        }
        CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                invite.conversationId(),
                actorId,
                defaultConversationRoleIds(invite.conversationId()),
                Instant.now(),
                invite.createdBy(),
                null,
                null,
                "INHERIT",
                null,
                Instant.now()
        );
        store.upsertConversationMember(member);
        CanonicalConversation conv = store.findConversation(invite.conversationId());
        if (conv != null) {
            store.addConversationMembershipProjection(actorId, conv, member);
        }
        appendAudit(actorId, invite.conversationId(), "JOIN_BY_INVITE", "conversation", invite.conversationId().toString(), null, null);
        return new CanonicalApiContracts.InviteConsumeResponse("ACCEPTED", invite.conversationId());
    }

    public List<CanonicalApiContracts.JoinRequestView> listJoinRequests(
            UUID actorId, UUID conversationId, int limit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        return store.listJoinRequests(conversationId, Math.max(1, Math.min(100, limit)));
    }

    public CanonicalApiContracts.JoinRequestView resolveJoinRequest(
            UUID actorId,
            UUID conversationId,
            UUID requestId,
            CanonicalApiContracts.JoinRequestDecisionRequest request) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        if (request.requestedAt() == null) {
            throw new BadRequestException("requestedAt is required");
        }
        if (!StringUtils.hasText(request.decision())) {
            throw new BadRequestException("decision is required");
        }
        String decision = request.decision().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVE", "DECLINE").contains(decision)) {
            throw new BadRequestException("decision must be APPROVE or DECLINE");
        }
        var row = store.findJoinRequest(conversationId, request.requestedAt(), requestId);
        if (row == null) {
            throw new NotFoundException("join request not found");
        }
        if (!"PENDING".equals(row.getString("status"))) {
            throw new ConflictException("join request is no longer pending");
        }
        if (!store.claimJoinRequestResolution(conversationId, request.requestedAt(), requestId, actorId)) {
            throw new ConflictException("join request was resolved concurrently");
        }
        UUID userId = row.getUuid("user_id");
        String token = row.getString("link_token");
        CanonicalInviteLink invite = store.findInviteByToken(token);
        if ("DECLINE".equals(decision)) {
            store.finishJoinRequestResolution(
                    conversationId, request.requestedAt(), requestId, "DECLINED", actorId);
            if (invite != null) {
                store.declineInvite(invite, userId);
            }
            appendAudit(actorId, conversationId, "JOIN_REQUEST_DECLINE", "join_request",
                    requestId.toString(), userId, request.reason());
            return resolvedJoinRequest(conversationId, request.requestedAt(), requestId);
        }
        if (invite == null || !invite.linkId().equals(row.getUuid("link_id"))
                || !"ACTIVE".equals(inviteStatus(invite, invite.usedCount() == null ? 0 : invite.usedCount()))) {
            store.finishJoinRequestResolution(
                    conversationId, request.requestedAt(), requestId, "FAILED", actorId);
            throw new ConflictException("invite is no longer usable");
        }
        if (store.findConversationMember(conversationId, userId) == null) {
            if (!store.reserveInviteUse(invite)) {
                store.finishJoinRequestResolution(
                        conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("invite usage changed concurrently; retry with a new invite");
            }
            CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                    conversationId, userId, defaultConversationRoleIds(conversationId), Instant.now(), actorId,
                    null, null, "INHERIT", null, Instant.now());
            store.upsertConversationMember(member);
            CanonicalConversation conversation = store.findConversation(conversationId);
            if (conversation != null) {
                store.addConversationMembershipProjection(userId, conversation, member);
            }
        }
        store.markInviteJoinAccepted(invite, userId);
        store.finishJoinRequestResolution(
                conversationId, request.requestedAt(), requestId, "APPROVED", actorId);
        appendAudit(actorId, conversationId, "JOIN_REQUEST_APPROVE", "join_request",
                requestId.toString(), userId, request.reason());
        return resolvedJoinRequest(conversationId, request.requestedAt(), requestId);
    }

    private CanonicalApiContracts.JoinRequestView resolvedJoinRequest(
            UUID conversationId, UUID requestedAt, UUID requestId) {
        var resolved = store.findJoinRequest(conversationId, requestedAt, requestId);
        if (resolved == null) {
            throw new NotFoundException("join request not found");
        }
        return new CanonicalApiContracts.JoinRequestView(
                conversationId, requestedAt, requestId, resolved.getUuid("user_id"),
                resolved.getUuid("link_id"), resolved.getString("status"),
                resolved.getUuid("resolved_by"), resolved.getInstant("resolved_at"));
    }

    private Set<UUID> defaultConversationRoleIds(UUID conversationId) {
        return conversationRepository.findRoles(conversationId).stream()
                .filter(ConversationRole::isDefault)
                .map(ConversationRole::roleId)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public void revokeInvite(UUID actorId, String token) {
        CanonicalInviteLink invite = store.findInviteByToken(token);
        if (invite == null) {
            throw new NotFoundException("invite not found");
        }
        authorization.requirePermission(invite.conversationId(), actorId, ConversationPermission.INVITE_MANAGE);
        store.revokeInvite(invite, actorId);
        appendAudit(actorId, invite.conversationId(), "INVITE_REVOKE", "invite", invite.linkId().toString(), null, null);
    }

    public CanonicalApiContracts.InviteConsumeResponse declineInvite(UUID actorId, String token) {
        CanonicalInviteLink invite = store.findInviteByToken(token);
        if (invite == null) {
            return new CanonicalApiContracts.InviteConsumeResponse("INVALID", null);
        }
        if (!store.declineInvite(invite, actorId)) {
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_ACCEPTED", invite.conversationId());
        }
        appendAudit(actorId, invite.conversationId(), "INVITE_DECLINE", "invite", invite.linkId().toString(), null, null);
        return new CanonicalApiContracts.InviteConsumeResponse("DECLINED", invite.conversationId());
    }

    private String inviteStatus(CanonicalInviteLink invite, int usedCount) {
        if (!Boolean.TRUE.equals(invite.isActive())) {
            return invite.revokedAt() == null ? "INACTIVE" : "REVOKED";
        }
        if (invite.expiresAt() != null && !invite.expiresAt().isAfter(Instant.now())) {
            return "EXPIRED";
        }
        if (invite.maxUses() != null && usedCount >= invite.maxUses()) {
            return "LIMIT_REACHED";
        }
        return "ACTIVE";
    }

    public CanonicalNotificationSettings getNotificationSettings(UUID actorId) {
        CanonicalNotificationSettings setting = store.readNotificationSetting(actorId);
        if (setting == null) {
            setting = new CqlCanonicalRecords.CanonicalNotificationSettings(
                    actorId, "ALL", true, true, true, true, null, null, "UTC", Instant.now()
            );
            store.saveNotificationSetting(setting);
        }
        return setting;
    }

    public void updateNotificationSettings(UUID actorId, CanonicalApiContracts.NotificationSettingRequest req) {
        if (req == null) {
            throw new BadRequestException("notification settings are required");
        }
        store.saveNotificationSetting(new CqlCanonicalRecords.CanonicalNotificationSettings(
                actorId,
                NotificationSettingsPolicy.requireLevel(req.globalLevel()),
                NotificationSettingsPolicy.requireBoolean(req.pushEnabled(), "pushEnabled"),
                NotificationSettingsPolicy.requireBoolean(req.emailEnabled(), "emailEnabled"),
                NotificationSettingsPolicy.requireBoolean(req.desktopEnabled(), "desktopEnabled"),
                NotificationSettingsPolicy.requireBoolean(req.soundEnabled(), "soundEnabled"),
                NotificationSettingsPolicy.normalizeClock(req.quietHoursStart(), "quietHoursStart"),
                NotificationSettingsPolicy.normalizeClock(req.quietHoursEnd(), "quietHoursEnd"),
                NotificationSettingsPolicy.normalizeTimezone(req.timezone()),
                Instant.now()
        ));
    }

    public List<CanonicalNotification> notifications(UUID actorId, String month, int limit) {
        requireUser(actorId);
        return store.listNotifications(actorId, month, Math.max(1, Math.min(200, limit)));
    }

    public void markNotificationRead(UUID actorId, String month, UUID notificationId) {
        requireUser(actorId);
        store.markNotificationRead(actorId, month, notificationId);
    }

    public void deleteNotification(UUID actorId, String month, UUID notificationId) {
        requireUser(actorId);
        store.deleteNotification(actorId, month, notificationId);
    }

    public void deleteNotifications(UUID actorId, String month) {
        requireUser(actorId);
        store.deleteNotificationsByMonth(actorId, month);
    }

    public List<CanonicalAnalyticsPoint> adminDashboard(UUID actorId, LocalDate from, LocalDate to, String eventType) {
        requireUser(actorId);
        if (from == null || to == null || to.isBefore(from)) {
            throw new BadRequestException("invalid date range");
        }
        List<CanonicalAnalyticsPoint> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            out.addAll(store.listAnalytics(d, normalize(eventType, "ALL"), 2000));
        }
        return out;
    }

    private void requireMember(UUID conversationId, UUID userId) {
        if (store.findConversationMember(conversationId, userId) == null) {
            throw new ForbiddenException("not member of conversation");
        }
    }

    private Set<UUID> createSystemConversationRoles(UUID conversationId, UUID actorId, Instant now) {
        UUID ownerRoleId = UUID.randomUUID();
        UUID memberRoleId = UUID.randomUUID();
        conversationRepository.saveRole(new ConversationRole(
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
        conversationRepository.saveRole(new ConversationRole(
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
        eventRecorder.record(
                actorId,
                conversationId,
                action,
                resourceType,
                resourceId,
                targetUserId,
                reason,
                Map.of(),
                Map.of());
    }

    private void recordMessageEvent(
            UUID actorId, String action, CanonicalMessage message, Set<UUID> mentionedUserIds) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("messageId", message.messageId().toString());
        payload.put("messageBucket", message.messageBucket());
        payload.put("senderId", message.senderId().toString());
        payload.put("messageType", message.messageType());
        payload.put("content", message.content());
        payload.put("replyToSenderId", message.replyToSenderId() == null ? null : message.replyToSenderId().toString());
        payload.put("hasAttachments", Boolean.TRUE.equals(message.hasAttachments()));
        payload.put("hasMentions", Boolean.TRUE.equals(message.hasMentions()));
        payload.put("isPinned", Boolean.TRUE.equals(message.isPinned()));
        payload.put("isDeleted", Boolean.TRUE.equals(message.isDeleted()));
        payload.put("createdAt", message.createdAt().toString());
        if (mentionedUserIds != null) {
            payload.put("mentionedUserIds", mentionedUserIds.stream().map(UUID::toString).toList());
        }
        eventRecorder.record(
                actorId, message.conversationId(), action, "message", message.messageId().toString(),
                null, null, Map.of(), Map.of(), payload);
        publishMessageEvent(action, message);
    }

    private void notifyConversationMembers(
            UUID actorId,
            CanonicalMessage message,
            CanonicalUser sender,
            List<ConversationMember> members,
            Set<UUID> mentionedUserIds) {
        if (members == null || members.isEmpty()) {
            return;
        }
        if (sender == null) {
            throw new IllegalStateException("message sender does not exist");
        }
        if (!StringUtils.hasText(sender.displayName())) {
            throw new IllegalStateException("message sender displayName is missing");
        }
        String senderName = sender.displayName().trim();
        String body = message.content().trim();
        String preview = body.length() > 160 ? body.substring(0, 157) + "..." : body;
        String month = YearMonth.now(ZoneOffset.UTC).toString();
        for (ConversationMember member : members) {
            UUID recipientId = member.userId();
            if (recipientId == null || recipientId.equals(actorId)) {
                continue;
            }
            boolean mention = mentionedUserIds != null && mentionedUserIds.contains(recipientId);
            UUID notificationId = Uuids.timeBased();
            CanonicalNotification notification = new CanonicalNotification(
                    recipientId,
                    month,
                    notificationId,
                    mention ? "MENTION" : "MESSAGE",
                    "NORMAL",
                    message.conversationId(),
                    message.messageBucket(),
                    message.messageId(),
                    actorId,
                    senderName,
                    preview,
                    "/app?conversation=" + message.conversationId(),
                    Map.of("conversationId", message.conversationId().toString(),
                            "messageId", message.messageId().toString(),
                            "messageBucket", message.messageBucket()),
                    false,
                    null,
                    Instant.now());
            store.upsertNotification(notification);
            messaging.convertAndSendToUser(recipientId.toString(), "/queue/notifications", Map.of(
                    "notificationId", notificationId.toString(),
                    "userId", recipientId.toString(),
                    "type", notification.notificationType(),
                    "title", notification.title(),
                    "body", notification.bodyPreview(),
                    "isRead", false,
                    "createdAt", notification.createdAt().toString(),
                    "metadata", notification.actionPayload()));
        }
    }

    private void publishMessageEvent(String action, CanonicalMessage message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", action);
        payload.put("conversationId", message.conversationId().toString());
        payload.put("messageId", message.messageId().toString());
        payload.put("messageBucket", message.messageBucket());
        payload.put("clientMessageId", message.clientMessageId() == null ? null : message.clientMessageId().toString());
        payload.put("senderId", message.senderId().toString());
        payload.put("messageType", message.messageType());
        payload.put("content", message.content());
        payload.put("contentFormat", message.contentFormat());
        payload.put("replyToMessageId", message.replyToMessageId() == null ? null : message.replyToMessageId().toString());
        payload.put("replyToSenderId", message.replyToSenderId() == null ? null : message.replyToSenderId().toString());
        payload.put("stickerId", message.stickerId() == null ? null : message.stickerId().toString());
        payload.put("pollId", message.pollId() == null ? null : message.pollId().toString());
        payload.put("systemEventId", message.systemEventId() == null ? null : message.systemEventId().toString());
        payload.put("forwardedFromConversationId", message.forwardedFromConversationId() == null ? null : message.forwardedFromConversationId().toString());
        payload.put("forwardedFromMessageBucket", message.forwardedFromMessageBucket());
        payload.put("forwardedFromMessageId", message.forwardedFromMessageId() == null ? null : message.forwardedFromMessageId().toString());
        payload.put("createdAt", message.createdAt().toString());
        payload.put("editedAt", message.editedAt() == null ? null : message.editedAt().toString());
        payload.put("deletedBy", message.deletedBy() == null ? null : message.deletedBy().toString());
        payload.put("deletedAt", message.deletedAt() == null ? null : message.deletedAt().toString());
        payload.put("isDeleted", Boolean.TRUE.equals(message.isDeleted()));
        payload.put("isPinned", Boolean.TRUE.equals(message.isPinned()));
        payload.put("hasAttachments", Boolean.TRUE.equals(message.hasAttachments()));
        payload.put("hasMentions", Boolean.TRUE.equals(message.hasMentions()));
        publishConversationEvent(message.conversationId(), "", payload);
    }

    private void publishConversationEvent(UUID conversationId, String suffix, Object payload) {
        messaging.convertAndSend("/topic/conversation/" + conversationId + suffix, payload);
    }

    private String normalize(String input) {
        return StringUtils.hasText(input) ? input.trim().toLowerCase() : "";
    }

    private String normalize(String input, String defaultValue) {
        return StringUtils.hasText(input) ? input.trim() : defaultValue;
    }

    private String defaultConversationName(String type) {
        return "DM".equalsIgnoreCase(type) ? "Direct Message" : "Conversation";
    }

    private String createInviteToken() {
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    private String joinUrl(String token) {
        return publicBaseUrl.replaceAll("/+$", "") + "/join/" + token;
    }

    private String buildDmPairKey(UUID userA, UUID userB) {
        String a = userA.toString();
        String b = userB.toString();
        return a.compareTo(b) <= 0 ? a + ":" + b : b + ":" + a;
    }
}
