package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.community.CommunityDirectoryFilter;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
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
import com.chatapp.chat_service.canonical.notification.NotificationPolicyEvaluator;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
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
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
        store.saveNotificationSetting(new CanonicalNotificationSettings(
                userId, "ALL", true, true, true, true, null, null, "UTC", now));
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
        if (requestedMemberIds.size() > 200) {
            throw new BadRequestException("initial members must not exceed 200; add remaining members after creation");
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

    public CanonicalApiContracts.CommunityPage listCommunities(
            UUID actorId,
            String languageCode,
            String categoryId,
            String tag,
            String query,
            String cursor,
            int requestedLimit) {
        requireUser(actorId);
        if (StringUtils.hasText(categoryId) && StringUtils.hasText(tag)) {
            throw new BadRequestException("categoryId and tag cannot be combined");
        }
        int limit = Math.max(1, Math.min(50, requestedLimit));
        String filter = CommunityDirectoryFilter.selected(
                normalize(languageCode, "vi"), categoryId, tag);
        String namePrefix = normalize(query);
        CommunityCursor after = decodeCommunityCursor(cursor);
        if (after != null
                && (!filter.equals(after.discoveryFilter()) || !namePrefix.equals(after.namePrefix()))) {
            throw new BadRequestException("community cursor does not match the active filters");
        }
        List<CanonicalCqlStore.CommunityDirectoryKey> keys = store.listCommunityDirectory(
                filter,
                namePrefix,
                after == null ? null : after.nameNormalized(),
                after == null ? null : after.conversationId(),
                limit + 1);
        boolean hasNext = keys.size() > limit;
        List<CanonicalCqlStore.CommunityDirectoryKey> pageKeys = keys.stream().limit(limit).toList();
        List<CanonicalApiContracts.CommunitySummary> content = new ArrayList<>(pageKeys.size());
        for (CanonicalCqlStore.CommunityDirectoryKey key : pageKeys) {
            CanonicalConversation conversation = store.findConversation(key.conversationId());
            if (conversation == null
                    || Boolean.TRUE.equals(conversation.isDeleted())
                    || !"COMMUNITY".equals(conversation.visibility())) {
                continue;
            }
            boolean joined = store.findConversationMember(conversation.conversationId(), actorId) != null;
            String membershipStatus = joined
                    ? "JOINED"
                    : publicCommunityMembershipStatus(
                            store.findCommunityJoinStatus(conversation.conversationId(), actorId));
            content.add(new CanonicalApiContracts.CommunitySummary(
                    conversation.conversationId(), conversation.name(), conversation.description(),
                    conversation.avatarUrl(), conversation.categoryId(), conversation.communityTags(),
                    conversation.languageCode(), conversation.joinPolicy(), conversation.memberCount(),
                    conversation.maxMembers(), conversation.lastActivityAt(), membershipStatus));
        }
        String nextCursor = hasNext && !pageKeys.isEmpty()
                ? encodeCommunityCursor(filter, namePrefix, pageKeys.get(pageKeys.size() - 1))
                : null;
        return new CanonicalApiContracts.CommunityPage(content, nextCursor, hasNext);
    }

    public CanonicalApiContracts.CommunityJoinResponse joinCommunity(UUID actorId, UUID conversationId) {
        requireUser(actorId);
        CanonicalConversation conversation = getConversation(conversationId);
        if (!"COMMUNITY".equals(conversation.visibility())) {
            throw new BadRequestException("conversation is not a public community");
        }
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            throw new ConflictException("archived communities cannot accept members");
        }
        CanonicalConversationMember existing = store.findConversationMember(conversationId, actorId);
        if (existing != null) {
            repairMembershipProjections(existing);
            return new CanonicalApiContracts.CommunityJoinResponse("JOINED", conversationId);
        }
        if ("REQUEST_APPROVAL".equals(conversation.joinPolicy())) {
            CanonicalCqlStore.CommunityJoinClaim claim = store.requestCommunityApproval(conversationId, actorId);
            if (claim.created()) {
                appendAudit(actorId, conversationId, "COMMUNITY_JOIN_REQUEST", "conversation",
                        conversationId.toString(), actorId, null);
            }
            String publicStatus = switch (claim.status()) {
                case "PENDING", "APPROVING" -> "PENDING";
                case "RETRY_REQUIRED" -> "RETRY_REQUIRED";
                default -> throw new IllegalStateException(
                        "unsupported community join claim status: " + claim.status());
            };
            return new CanonicalApiContracts.CommunityJoinResponse(publicStatus, conversationId);
        }
        if (!"DIRECT_JOIN".equals(conversation.joinPolicy())) {
            throw new ConflictException("community is not accepting public joins");
        }
        CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                conversationId, actorId, defaultConversationRoleIds(conversationId), Instant.now(), null,
                null, null, "INHERIT", null, Instant.now());
        CanonicalCqlStore.MembershipMutationResult result = store.tryAddConversationMember(member);
        if (result == CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED) {
            return new CanonicalApiContracts.CommunityJoinResponse("CAPACITY_REACHED", conversationId);
        }
        CanonicalConversationMember currentMember = result == CanonicalCqlStore.MembershipMutationResult.ADDED
                ? member
                : store.findConversationMember(conversationId, actorId);
        if (currentMember == null) {
            throw new IllegalStateException("conversation member is missing after membership claim");
        }
        repairMembershipProjections(currentMember);
        if (result == CanonicalCqlStore.MembershipMutationResult.ADDED) {
            appendAudit(actorId, conversationId, "COMMUNITY_JOIN", "conversation",
                    conversationId.toString(), actorId, null);
        }
        return new CanonicalApiContracts.CommunityJoinResponse("JOINED", conversationId);
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
                    CanonicalUser user = store.findUserById(member.userId());
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
        CanonicalUser invitedUser = store.findUserById(req.userId());
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
        var result = store.tryAddConversationMember(member);
        if (result == CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED) {
            throw new ConflictException("conversation capacity has been reached");
        }
        CanonicalConversationMember currentMember = result == CanonicalCqlStore.MembershipMutationResult.ADDED
                ? member
                : store.findConversationMember(conversationId, req.userId());
        if (currentMember == null) {
            throw new IllegalStateException("conversation member is missing after membership claim");
        }
        repairMembershipProjections(currentMember);
        if (result == CanonicalCqlStore.MembershipMutationResult.ALREADY_MEMBER) {
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

    public CanonicalMessage pinMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
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
        return store.findMessage(conversationId, bucket, messageId);
    }

    public CanonicalMessage unpinMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_PIN);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        store.pinMessage(conversationId, bucket, messageId, actorId, false);
        appendAudit(actorId, conversationId, "MESSAGE_UNPIN", "message", messageId.toString(), null, null);
        publishConversationEvent(conversationId, "/pins", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "pinnedBy", actorId.toString(), "action", "UNPIN"));
        return store.findMessage(conversationId, bucket, messageId);
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
        Map<String, List<UUID>> messageIdsByBucket = content.stream()
                .collect(Collectors.groupingBy(
                        CanonicalMessage::messageBucket,
                        LinkedHashMap::new,
                        Collectors.mapping(CanonicalMessage::messageId, Collectors.toList())));
        List<CanonicalApiContracts.MessageInteractionView> interactions = messageIdsByBucket.entrySet()
                .stream()
                .flatMap(entry -> store.listMessageInteractions(
                        conversationId, entry.getKey(), entry.getValue(), actorId).stream())
                .toList();
        List<UUID> pollIds = content.stream()
                .map(CanonicalMessage::pollId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        List<CanonicalApiContracts.PollView> polls = pollViews(actorId, pollIds);
        return new CanonicalApiContracts.MessagePage(
                content, nextCursor, hasNext && nextCursor != null, interactions, polls);
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
        Instant readAt = Instant.now();
        store.markMessageRead(conversationId, bucket, messageId, actorId, readAt);
        publishConversationEvent(conversationId, "/read", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "readerId", actorId.toString(), "readAt", readAt.toString()));
    }

    public CanonicalApiContracts.MessageReadReceiptPage listMessageReadReceipts(
            UUID actorId,
            UUID conversationId,
            String bucket,
            UUID messageId,
            int requestedLimit,
            UUID cursor) {
        requireMember(conversationId, actorId);
        if (store.findMessage(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        int limit = Math.max(1, Math.min(50, requestedLimit));
        List<CanonicalCqlStore.MessageReadReceiptRow> rows = store.listMessageReadReceipts(
                conversationId, bucket, messageId, cursor, limit + 1);
        boolean hasNext = rows.size() > limit;
        List<CanonicalCqlStore.MessageReadReceiptRow> pageRows = hasNext
                ? List.copyOf(rows.subList(0, limit))
                : List.copyOf(rows);
        Map<UUID, CanonicalCqlStore.CanonicalUserProfile> usersById = store.findUserProfilesByIds(pageRows.stream()
                .map(CanonicalCqlStore.MessageReadReceiptRow::readerId)
                .distinct()
                .toList()).stream()
                .collect(Collectors.toMap(CanonicalCqlStore.CanonicalUserProfile::userId, user -> user));
        List<CanonicalApiContracts.MessageReadReceiptView> content = pageRows.stream()
                .map(row -> {
                    CanonicalCqlStore.CanonicalUserProfile user = usersById.get(row.readerId());
                    return new CanonicalApiContracts.MessageReadReceiptView(
                            row.readerId(),
                            user == null ? null : user.username(),
                            user == null ? null : user.displayName(),
                            user == null ? null : user.avatarUrl(),
                            row.readAt());
                })
                .toList();
        UUID nextCursor = hasNext && !pageRows.isEmpty()
                ? pageRows.get(pageRows.size() - 1).readerId()
                : null;
        return new CanonicalApiContracts.MessageReadReceiptPage(content, nextCursor, hasNext);
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
        UUID pollId = UUID.nameUUIDFromBytes(
                (actorId + "|poll|" + req.clientMessageId()).getBytes(StandardCharsets.UTF_8));
        CanonicalMessage pollMessage = sendMessage(actorId, req.conversationId(),
                new CanonicalApiContracts.MessageSendRequest(
                        req.clientMessageId(), "POLL", req.question().trim(), "PLAIN",
                        null, null, null, pollId, null, null, null, List.of(), Set.of()));
        CanonicalPoll existing = store.findPollById(pollId);
        if (existing != null) {
            if (!pollRequestMatches(existing, req)) {
                throw new ConflictException("clientMessageId is already bound to another poll payload");
            }
            return pollView(actorId, existing);
        }
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
                null
        );
        store.createPoll(poll);
        appendAudit(actorId, req.conversationId(), "POLL_CREATE", "poll", poll.pollId().toString(), null, null);
        CanonicalApiContracts.PollView view = pollView(actorId, poll);
        publishPollAggregate(view);
        return view;
    }

    private boolean pollRequestMatches(CanonicalPoll poll, CanonicalApiContracts.PollCreateRequest request) {
        return poll.conversationId().equals(request.conversationId())
                && poll.question().equals(request.question().trim())
                && poll.options().equals(request.options().stream().map(String::trim).toList())
                && poll.isMultipleChoice().equals(Boolean.TRUE.equals(request.isMultipleChoice()))
                && poll.isAnonymous().equals(Boolean.TRUE.equals(request.isAnonymous()))
                && Objects.equals(poll.closesAt(), request.closesAt());
    }

    public CanonicalApiContracts.PollView getPoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requirePoll(actorId, pollId);
        CanonicalApiContracts.PollView view = pollView(actorId, poll);
        publishPollAggregate(view);
        return view;
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
        if (result == CanonicalCqlStore.VoteResult.CLOSED) {
            throw new ConflictException("poll is closed");
        }
        if (result == CanonicalCqlStore.VoteResult.CONFLICT) {
            throw new ConflictException("vote changed concurrently; reload the poll and retry");
        }
        if (result == CanonicalCqlStore.VoteResult.CREATED || result == CanonicalCqlStore.VoteResult.UPDATED) {
            appendAudit(actorId, poll.conversationId(),
                    result == CanonicalCqlStore.VoteResult.CREATED ? "POLL_VOTE" : "POLL_VOTE_CHANGE",
                    "poll", pollId.toString(), actorId, null);
        }
        CanonicalApiContracts.PollView view = pollView(actorId, poll);
        publishPollAggregate(view);
        return view;
    }

    public CanonicalApiContracts.PollView removePollVote(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requireOpenPoll(actorId, pollId);
        var result = store.removePollVote(pollId, actorId);
        if (result == CanonicalCqlStore.VoteResult.CLOSED) {
            throw new ConflictException("poll is closed");
        }
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
        CanonicalApiContracts.PollView view = pollView(actorId, requirePoll(actorId, pollId));
        publishPollAggregate(view);
        return view;
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
        CanonicalCqlStore.PollState state = store.listPollStates(List.of(poll.pollId()), actorId)
                .get(poll.pollId());
        if (state == null) {
            throw new IllegalStateException("poll state is missing");
        }
        return new CanonicalApiContracts.PollView(
                poll,
                state.optionCounts(),
                state.currentUserOptionIndexes(),
                state.totalVoters());
    }

    private List<CanonicalApiContracts.PollView> pollViews(UUID actorId, List<UUID> pollIds) {
        if (pollIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, CanonicalPoll> pollsById = store.findPollsByIds(pollIds).stream()
                .collect(Collectors.toMap(CanonicalPoll::pollId, poll -> poll));
        Map<UUID, CanonicalCqlStore.PollState> statesById = store.listPollStates(pollIds, actorId);
        return pollIds.stream().map(pollId -> {
            CanonicalPoll poll = pollsById.get(pollId);
            CanonicalCqlStore.PollState state = statesById.get(pollId);
            if (poll == null || state == null) {
                throw new IllegalStateException("poll projection is incomplete");
            }
            return new CanonicalApiContracts.PollView(
                    poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters());
        }).toList();
    }

    private void publishPollAggregate(CanonicalApiContracts.PollView view) {
        publishConversationEvent(view.poll().conversationId(), "/polls",
                new CanonicalApiContracts.PollAggregateView(
                        view.poll(), view.optionCounts(), view.totalVoters()));
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
        CanonicalConversationMember existingMember = store.findConversationMember(invite.conversationId(), actorId);
        if (existingMember != null) {
            repairMembershipProjections(existingMember);
            store.recordInviteOutcome(invite, actorId, "ALREADY_MEMBER");
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_MEMBER", invite.conversationId());
        }
        String priorJoinStatus = store.findInviteJoinStatus(invite.linkId(), actorId);
        boolean hasReservedDirectInviteUse = "DIRECT_JOIN".equals(invite.joinPolicy())
                && "ACCEPTED".equals(priorJoinStatus);
        String status = inviteStatus(invite, invite.usedCount() == null ? 0 : invite.usedCount());
        if (!"ACTIVE".equals(status) && !hasReservedDirectInviteUse) {
            store.recordInviteOutcome(invite, actorId, status);
            return new CanonicalApiContracts.InviteConsumeResponse(status, invite.conversationId());
        }
        if ("REQUEST_APPROVAL".equals(invite.joinPolicy())) {
            String requestStatus = store.requestInviteApproval(invite, actorId);
            appendAudit(actorId, invite.conversationId(), "JOIN_REQUEST_CREATE", "invite", invite.linkId().toString(), null, null);
            return new CanonicalApiContracts.InviteConsumeResponse(
                    "ACCEPTED".equals(requestStatus) ? "PENDING" : requestStatus,
                    invite.conversationId());
        }
        CanonicalCqlStore.MembershipState membership = store.requireMembershipState(invite.conversationId());
        if (membership.memberCount() >= membership.maxMembers()) {
            if (hasReservedDirectInviteUse) {
                store.releaseInviteUse(invite, actorId);
            }
            return new CanonicalApiContracts.InviteConsumeResponse("CAPACITY_REACHED", invite.conversationId());
        }
        CanonicalCqlStore.InviteConsumeResult inviteResult = hasReservedDirectInviteUse
                ? CanonicalCqlStore.InviteConsumeResult.ALREADY_ACCEPTED
                : store.consumeInvite(req.linkToken(), actorId);
        boolean reservedByThisCommand = inviteResult == CanonicalCqlStore.InviteConsumeResult.CONSUMED;
        if (!reservedByThisCommand && inviteResult != CanonicalCqlStore.InviteConsumeResult.ALREADY_ACCEPTED) {
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
        var membershipResult = store.tryAddConversationMember(member);
        if (membershipResult == CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED) {
            store.releaseInviteUse(invite, actorId);
            return new CanonicalApiContracts.InviteConsumeResponse("CAPACITY_REACHED", invite.conversationId());
        }
        if (membershipResult == CanonicalCqlStore.MembershipMutationResult.ALREADY_MEMBER) {
            if (reservedByThisCommand) {
                store.releaseInviteUse(invite, actorId);
            }
            CanonicalConversationMember currentMember = store.findConversationMember(invite.conversationId(), actorId);
            if (currentMember == null) {
                throw new IllegalStateException("conversation member is missing after membership claim");
            }
            repairMembershipProjections(currentMember);
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_MEMBER", invite.conversationId());
        }
        repairMembershipProjections(member);
        appendAudit(actorId, invite.conversationId(), "JOIN_BY_INVITE", "conversation", invite.conversationId().toString(), null, null);
        return new CanonicalApiContracts.InviteConsumeResponse("ACCEPTED", invite.conversationId());
    }

    public CanonicalApiContracts.InviteViewerState getInviteViewerState(UUID actorId, String token) {
        CanonicalInviteLink invite = store.findInviteByToken(token);
        if (invite == null) {
            return new CanonicalApiContracts.InviteViewerState("INVALID", null);
        }
        if (store.findConversationMember(invite.conversationId(), actorId) != null) {
            return new CanonicalApiContracts.InviteViewerState("ALREADY_MEMBER", invite.conversationId());
        }
        String status = store.findInviteJoinStatus(invite.linkId(), actorId);
        if (status == null) {
            return new CanonicalApiContracts.InviteViewerState("AVAILABLE", invite.conversationId());
        }
        if (!Set.of("PENDING", "ACCEPTED", "DECLINED", "FAILED").contains(status)) {
            throw new IllegalStateException("unsupported invite viewer status: " + status);
        }
        if ("ACCEPTED".equals(status)) {
            return new CanonicalApiContracts.InviteViewerState(
                    "REQUEST_APPROVAL".equals(invite.joinPolicy()) ? "PENDING" : "FAILED",
                    invite.conversationId());
        }
        return new CanonicalApiContracts.InviteViewerState(status, invite.conversationId());
    }

    public List<CanonicalApiContracts.JoinRequestView> listJoinRequests(
            UUID actorId, UUID conversationId, int limit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        int boundedLimit = Math.max(1, Math.min(100, limit));
        List<CanonicalApiContracts.JoinRequestView> requests = new ArrayList<>();
        requests.addAll(store.listJoinRequests(conversationId, boundedLimit));
        requests.addAll(store.listCommunityJoinRequests(conversationId, boundedLimit));
        return requests.stream()
                .sorted(Comparator.comparingLong(
                        (CanonicalApiContracts.JoinRequestView item) -> Uuids.unixTimestamp(item.requestedAt()))
                        .reversed())
                .limit(boundedLimit)
                .toList();
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
            return resolveCommunityJoinRequest(actorId, conversationId, requestId, request);
        }
        boolean continuingOwnClaim = "APPROVING".equals(row.getString("status"))
                && actorId.equals(row.getUuid("resolved_by"))
                && decision.equals(row.getString("resolution_decision"));
        if (!"PENDING".equals(row.getString("status")) && !continuingOwnClaim) {
            throw new ConflictException("join request is no longer pending");
        }
        if (!continuingOwnClaim && !store.claimJoinRequestResolution(
                conversationId, request.requestedAt(), requestId, actorId, decision)) {
            throw new ConflictException("join request was resolved concurrently");
        }
        UUID userId = row.getUuid("user_id");
        CanonicalInviteLink invite = store.findInviteByToken(row.getString("link_token"));
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
        boolean inviteMatchesRequest = invite != null && invite.linkId().equals(row.getUuid("link_id"));
        boolean inviteAcceptanceRecorded = inviteMatchesRequest && "ACCEPTED".equals(
                store.findInviteJoinStatus(invite.linkId(), userId));
        if (!inviteMatchesRequest || (!inviteAcceptanceRecorded
                && !"ACTIVE".equals(inviteStatus(invite, invite.usedCount() == null ? 0 : invite.usedCount())))) {
            if (inviteMatchesRequest) {
                store.markInviteJoinFailed(invite, userId);
            }
            store.finishJoinRequestResolution(
                    conversationId, request.requestedAt(), requestId, "FAILED", actorId);
            throw new ConflictException("invite is no longer usable");
        }
        CanonicalConversationMember existingMember = store.findConversationMember(conversationId, userId);
        if (existingMember == null) {
            CanonicalCqlStore.MembershipState membership = store.requireMembershipState(conversationId);
            if (membership.memberCount() >= membership.maxMembers()) {
                if (inviteAcceptanceRecorded) {
                    store.releaseInviteUse(invite, userId);
                } else {
                    store.markInviteJoinFailed(invite, userId);
                }
                store.finishJoinRequestResolution(
                        conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            if (!inviteAcceptanceRecorded && !store.reserveInviteUse(invite)) {
                store.markInviteJoinFailed(invite, userId);
                store.finishJoinRequestResolution(
                        conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("invite usage changed concurrently; retry with a new invite");
            }
            if (!inviteAcceptanceRecorded) {
                store.markInviteJoinAccepted(invite, userId);
                inviteAcceptanceRecorded = true;
            }
            CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                    conversationId, userId, defaultConversationRoleIds(conversationId), Instant.now(), actorId,
                    null, null, "INHERIT", null, Instant.now());
            var membershipResult = store.tryAddConversationMember(member);
            if (membershipResult == CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED) {
                store.releaseInviteUse(invite, userId);
                store.finishJoinRequestResolution(
                        conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            if (membershipResult == CanonicalCqlStore.MembershipMutationResult.ALREADY_MEMBER) {
                store.releaseInviteUse(invite, userId);
            }
            CanonicalConversationMember currentMember = membershipResult == CanonicalCqlStore.MembershipMutationResult.ADDED
                    ? member
                    : store.findConversationMember(conversationId, userId);
            if (currentMember == null) {
                throw new IllegalStateException("conversation member is missing after membership claim");
            }
            repairMembershipProjections(currentMember);
        } else {
            repairMembershipProjections(existingMember);
        }
        if (!inviteAcceptanceRecorded) {
            store.markInviteJoinAccepted(invite, userId);
        }
        store.finishJoinRequestResolution(
                conversationId, request.requestedAt(), requestId, "APPROVED", actorId);
        appendAudit(actorId, conversationId, "JOIN_REQUEST_APPROVE", "join_request",
                requestId.toString(), userId, request.reason());
        return resolvedJoinRequest(conversationId, request.requestedAt(), requestId);
    }

    private CanonicalApiContracts.JoinRequestView resolveCommunityJoinRequest(
            UUID actorId,
            UUID conversationId,
            UUID requestId,
            CanonicalApiContracts.JoinRequestDecisionRequest request) {
        if (request.userId() == null) {
            throw new NotFoundException("join request not found");
        }
        CanonicalCqlStore.CommunityJoinRequestRow joinRequest =
                store.findCommunityJoinRequest(conversationId, request.userId());
        if (joinRequest == null
                || !requestId.equals(joinRequest.requestId())
                || !request.requestedAt().equals(joinRequest.requestedAt())) {
            throw new NotFoundException("join request not found");
        }
        String decision = request.decision().trim().toUpperCase(Locale.ROOT);
        boolean continuingOwnClaim = "APPROVING".equals(joinRequest.status())
                && actorId.equals(joinRequest.resolvedBy())
                && decision.equals(joinRequest.resolutionDecision());
        if (!"PENDING".equals(joinRequest.status()) && !continuingOwnClaim) {
            throw new ConflictException("join request is no longer pending");
        }
        if (!continuingOwnClaim && !store.claimCommunityJoinResolution(
                conversationId, request.userId(), requestId, actorId, decision)) {
            throw new ConflictException("join request was resolved concurrently");
        }
        if ("DECLINE".equals(decision)) {
            store.finishCommunityJoinResolution(
                    conversationId, request.userId(), requestId, "DECLINED", actorId);
            appendAudit(actorId, conversationId, "JOIN_REQUEST_DECLINE", "community_join_request",
                    requestId.toString(), request.userId(), request.reason());
            return store.findCommunityJoinRequest(conversationId, request.userId()).toView();
        }
        CanonicalConversation conversation = getConversation(conversationId);
        if (!"COMMUNITY".equals(conversation.visibility()) || Boolean.TRUE.equals(conversation.isDeleted())) {
            store.finishCommunityJoinResolution(
                    conversationId, request.userId(), requestId, "FAILED", actorId);
            throw new ConflictException("community is no longer accepting requests");
        }
        CanonicalConversationMember existingMember =
                store.findConversationMember(conversationId, request.userId());
        if (existingMember == null) {
            CanonicalCqlStore.MembershipState membership = store.requireMembershipState(conversationId);
            if (membership.memberCount() >= membership.maxMembers()) {
                store.finishCommunityJoinResolution(
                        conversationId, request.userId(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                    conversationId, request.userId(), defaultConversationRoleIds(conversationId), Instant.now(), actorId,
                    null, null, "INHERIT", null, Instant.now());
            CanonicalCqlStore.MembershipMutationResult result = store.tryAddConversationMember(member);
            if (result == CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED) {
                store.finishCommunityJoinResolution(
                        conversationId, request.userId(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            CanonicalConversationMember currentMember = result == CanonicalCqlStore.MembershipMutationResult.ADDED
                    ? member
                    : store.findConversationMember(conversationId, request.userId());
            if (currentMember == null) {
                throw new IllegalStateException("conversation member is missing after membership claim");
            }
            repairMembershipProjections(currentMember);
        } else {
            repairMembershipProjections(existingMember);
        }
        store.finishCommunityJoinResolution(
                conversationId, request.userId(), requestId, "APPROVED", actorId);
        appendAudit(actorId, conversationId, "JOIN_REQUEST_APPROVE", "community_join_request",
                requestId.toString(), request.userId(), request.reason());
        return store.findCommunityJoinRequest(conversationId, request.userId()).toView();
    }

    private String publicCommunityMembershipStatus(String storedStatus) {
        if (storedStatus == null || Set.of("DECLINED", "FAILED").contains(storedStatus)) {
            return "AVAILABLE";
        }
        if (Set.of("PENDING", "APPROVING").contains(storedStatus)) {
            return "PENDING";
        }
        if ("APPROVED".equals(storedStatus)) {
            return "AVAILABLE";
        }
        throw new IllegalStateException("unsupported community membership status: " + storedStatus);
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

    public CanonicalChatPreferences getChatAppearancePreferences(UUID actorId) {
        requireUser(actorId);
        CanonicalChatPreferences preferences = store.readChatPreferences(actorId);
        if (preferences == null) {
            preferences = new CanonicalChatPreferences(actorId, "aurora", "tiktok", null, Instant.now());
            store.saveChatPreferences(preferences);
        }
        return preferences;
    }

    public List<CanonicalConversationPreferences> listConversationAppearancePreferences(UUID actorId) {
        requireUser(actorId);
        return store.listConversationPreferences(actorId, 200);
    }

    public void updateChatAppearancePreferences(
            UUID actorId,
            CanonicalApiContracts.ChatAppearancePreferencesRequest request) {
        requireUser(actorId);
        if (request == null) {
            throw new BadRequestException("chat appearance preferences are required");
        }
        String defaultThemeId = requireThemeId(request.defaultThemeId());
        String defaultBubbleStyleId = requireBubbleStyleId(request.defaultBubbleStyleId());
        CanonicalChatPreferences current = getChatAppearancePreferences(actorId);
        store.saveChatPreferences(new CanonicalChatPreferences(
                actorId,
                defaultThemeId,
                defaultBubbleStyleId,
                current.defaultBackgroundAssetId(),
                Instant.now()));
    }

    public CanonicalCqlStore.DeviceSessionRow registerDevice(
            UUID actorId, CanonicalApiContracts.DeviceRegistrationRequest request) {
        requireAuthenticatedActor(actorId);
        if (request == null || request.deviceId() == null) {
            throw new BadRequestException("deviceId is required");
        }
        String platform = normalizeDeviceToken(request.platform(), "platform", Set.of("WEB", "IOS", "ANDROID"));
        String pushProvider = normalizeDeviceToken(
                request.pushProvider(), "pushProvider", Set.of("FCM", "APNS", "WEB_PUSH"));
        String pushToken = normalizeOptionalDeviceValue(request.pushToken(), 4096, "pushToken");
        String deviceName = normalizeOptionalDeviceValue(request.deviceName(), 120, "deviceName");
        String appVersion = normalizeOptionalDeviceValue(request.appVersion(), 50, "appVersion");
        return store.saveDevice(actorId, request.deviceId(), platform, pushProvider,
                pushToken, deviceName, appVersion, Instant.now());
    }

    public void touchDevice(UUID actorId, UUID deviceId) {
        requireAuthenticatedActor(actorId);
        if (deviceId == null || !store.touchDevice(actorId, deviceId, Instant.now())) {
            throw new NotFoundException("active device not found");
        }
    }

    private String normalizeDeviceToken(String value, String field, Set<String> allowed) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BadRequestException(field + " is invalid");
        }
        return normalized;
    }

    private String normalizeOptionalDeviceValue(String value, int maxLength, String field) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > maxLength) {
            throw new BadRequestException(field + " is too long");
        }
        return normalized;
    }

    public void updateConversationAppearancePreferences(
            UUID actorId,
            UUID conversationId,
            CanonicalApiContracts.ConversationAppearancePreferencesRequest request) {
        requireUser(actorId);
        if (conversationId == null || request == null) {
            throw new BadRequestException("conversation appearance preferences are required");
        }
        requireMember(conversationId, actorId);
        String customBackgroundUrl = normalizeBackgroundUrl(request.customBackgroundUrl());
        store.saveConversationPreferences(new CanonicalConversationPreferences(
                actorId,
                conversationId,
                requireThemeId(request.themeId()),
                null,
                null,
                customBackgroundUrl,
                Instant.now()));
    }

    public void deleteConversationAppearancePreferences(UUID actorId, UUID conversationId) {
        requireUser(actorId);
        if (conversationId == null) {
            throw new BadRequestException("conversationId is required");
        }
        requireMember(conversationId, actorId);
        store.deleteConversationPreferences(actorId, conversationId);
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

    private String requireThemeId(String themeId) {
        if (themeId == null || !Set.of("aurora", "neon", "studio", "vapor").contains(themeId)) {
            throw new BadRequestException("themeId must be one of aurora, neon, studio, vapor");
        }
        return themeId;
    }

    private String requireBubbleStyleId(String bubbleStyleId) {
        if (bubbleStyleId == null || !Set.of("tiktok", "glass", "classic").contains(bubbleStyleId)) {
            throw new BadRequestException("defaultBubbleStyleId must be one of tiktok, glass, classic");
        }
        return bubbleStyleId;
    }

    private String normalizeBackgroundUrl(String backgroundUrl) {
        if (backgroundUrl == null || backgroundUrl.isBlank()) {
            return null;
        }
        String normalized = backgroundUrl.trim();
        try {
            URI uri = URI.create(normalized);
            String scheme = uri.getScheme();
            if (uri.getHost() == null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
                throw new IllegalArgumentException("unsupported background URL");
            }
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("customBackgroundUrl must be an absolute http(s) URL");
        }
        return normalized;
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

    private String encodeCommunityCursor(
            String discoveryFilter,
            String namePrefix,
            CanonicalCqlStore.CommunityDirectoryKey key) {
        byte[] filter = discoveryFilter.getBytes(StandardCharsets.UTF_8);
        byte[] prefix = namePrefix.getBytes(StandardCharsets.UTF_8);
        byte[] name = key.nameNormalized().getBytes(StandardCharsets.UTF_8);
        ByteBuffer buffer = ByteBuffer.allocate(
                Integer.BYTES * 3 + filter.length + prefix.length + name.length + Long.BYTES * 2);
        buffer.putInt(filter.length);
        buffer.put(filter);
        buffer.putInt(prefix.length);
        buffer.put(prefix);
        buffer.putInt(name.length);
        buffer.put(name);
        buffer.putLong(key.conversationId().getMostSignificantBits());
        buffer.putLong(key.conversationId().getLeastSignificantBits());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.array());
    }

    private CommunityCursor decodeCommunityCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor);
            if (decoded.length > 8192) {
                throw new IllegalArgumentException("cursor is too large");
            }
            ByteBuffer buffer = ByteBuffer.wrap(decoded);
            String discoveryFilter = readCursorString(buffer);
            String namePrefix = readCursorString(buffer);
            String name = readCursorString(buffer);
            UUID conversationId = new UUID(buffer.getLong(), buffer.getLong());
            if (buffer.hasRemaining()) {
                throw new IllegalArgumentException("unexpected cursor data");
            }
            return new CommunityCursor(discoveryFilter, namePrefix, name, conversationId);
        } catch (IllegalArgumentException | java.nio.BufferUnderflowException ex) {
            throw new BadRequestException("community cursor is invalid");
        }
    }

    private String readCursorString(ByteBuffer buffer) {
        int length = buffer.getInt();
        if (length < 0 || length > buffer.remaining() - Long.BYTES * 2) {
            throw new IllegalArgumentException("invalid cursor string length");
        }
        byte[] value = new byte[length];
        buffer.get(value);
        return new String(value, StandardCharsets.UTF_8);
    }

    private record CommunityCursor(
            String discoveryFilter,
            String namePrefix,
            String nameNormalized,
            UUID conversationId) {
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
        CanonicalConversation conversation = getConversation(message.conversationId());
        String roomDefaultLevel = NotificationSettingsPolicy.requireRoomLevel(conversation.defaultNotificationLevel());
        String month = YearMonth.now(ZoneOffset.UTC).toString();
        for (ConversationMember member : members) {
            UUID recipientId = member.userId();
            if (recipientId == null || recipientId.equals(actorId)) {
                continue;
            }
            boolean mention = mentionedUserIds != null && mentionedUserIds.contains(recipientId);
            CanonicalNotificationSettings settings = getNotificationSettings(recipientId);
            if (!NotificationPolicyEvaluator.allows(
                    settings.globalLevel(),
                    roomDefaultLevel,
                    member.notificationOverride(),
                    conversation.conversationType(),
                    mention)) {
                continue;
            }
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
        return StringUtils.hasText(input) ? input.trim().toLowerCase(Locale.ROOT) : "";
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
