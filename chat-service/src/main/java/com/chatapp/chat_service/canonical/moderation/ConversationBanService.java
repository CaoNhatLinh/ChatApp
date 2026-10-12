package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
public class ConversationBanService {
    private final ConversationModerationRepository bans;
    private final CanonicalCqlStore store;
    private final ConversationAuthorizationService authorization;
    private final CanonicalEventRecorder events;
    private final AdminConversationDirectoryRepository adminDirectory;
    private final UserRepository users;

    public ConversationBanService(
            ConversationModerationRepository bans,
            CanonicalCqlStore store,
            ConversationAuthorizationService authorization,
            CanonicalEventRecorder events,
            AdminConversationDirectoryRepository adminDirectory,
            UserRepository users) {
        this.bans = bans;
        this.store = store;
        this.authorization = authorization;
        this.events = events;
        this.adminDirectory = adminDirectory;
        this.users = users;
    }

    public List<CanonicalApiContracts.ConversationBanView> list(UUID actorId, UUID conversationId, int limit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_BAN);
        List<ConversationModerationRepository.ConversationBan> activeBans =
                bans.listBans(conversationId, Instant.now(), limit);
        if (activeBans.isEmpty()) return List.of();
        Map<UUID, UserRepository.UserProfile> profiles = users.findProfilesByIds(
                        activeBans.stream().map(ConversationModerationRepository.ConversationBan::userId).toList())
                .stream().collect(Collectors.toMap(UserRepository.UserProfile::userId, Function.identity()));
        return activeBans.stream().map(ban -> toView(ban, profiles.get(ban.userId()))).toList();
    }

    public CanonicalApiContracts.ConversationBanView ban(
            UUID actorId,
            UUID conversationId,
            UUID userId,
            CanonicalApiContracts.ConversationBanRequest request) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_BAN);
        CanonicalConversation conversation = requireConversation(conversationId);
        if (userId.equals(conversation.ownerId())) {
            throw new ConflictException("conversation owner cannot be banned");
        }
        if (actorId.equals(userId)) {
            throw new ConflictException("cannot ban yourself");
        }
        if (request == null) {
            throw new BadRequestException("ban request is required");
        }
        CanonicalConversationMember member = store.findConversationMember(conversationId, userId);
        if (member == null && !bans.isBanned(conversationId, userId, Instant.now())) {
            throw new NotFoundException("conversation member not found");
        }
        String reasonCode = requireText(request.reasonCode(), "reasonCode", 64);
        String reasonText = requireText(request.reasonText(), "reasonText", 500);
        Instant now = Instant.now();
        if (request.expiresAt() != null && !request.expiresAt().isAfter(now)) {
            throw new BadRequestException("expiresAt must be in the future");
        }
        bans.ban(conversationId, userId, actorId, reasonCode, reasonText, request.expiresAt());
        if (member != null) {
            CanonicalCqlStore.MembershipMutationResult result = store.tryRemoveConversationMember(conversationId, userId);
            if (result == CanonicalCqlStore.MembershipMutationResult.OWNER_PROTECTED) {
                bans.clearBan(conversationId, userId);
                throw new ConflictException("conversation owner cannot be banned");
            }
            adminDirectory.index(requireConversation(conversationId));
        }
        events.record(actorId, conversationId, "MEMBER_BAN", "conversation_member", userId.toString(), userId,
                reasonText, Map.of(), Map.of("reasonCode", reasonCode,
                        "expiresAt", request.expiresAt() == null ? "never" : request.expiresAt().toString()));
        CanonicalUser user = users.findById(userId);
        return new CanonicalApiContracts.ConversationBanView(
                userId, user == null ? userId.toString() : user.displayName(), user == null ? null : user.avatarUrl(),
                actorId, reasonCode, reasonText, now, request.expiresAt());
    }

    public void unban(UUID actorId, UUID conversationId, UUID userId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MEMBER_BAN);
        requireConversation(conversationId);
        bans.clearBan(conversationId, userId);
        events.record(actorId, conversationId, "MEMBER_UNBAN", "conversation_member", userId.toString(), userId,
                null, Map.of(), Map.of());
    }

    private CanonicalApiContracts.ConversationBanView toView(
            ConversationModerationRepository.ConversationBan ban,
            UserRepository.UserProfile user) {
        return new CanonicalApiContracts.ConversationBanView(
                ban.userId(), user == null ? ban.userId().toString() : user.displayName(),
                user == null ? null : user.avatarUrl(), ban.bannedBy(), ban.reasonCode(),
                ban.reasonText(), ban.createdAt(), ban.expiresAt());
    }

    private CanonicalConversation requireConversation(UUID conversationId) {
        CanonicalConversation conversation = store.findConversation(conversationId);
        if (conversation == null) throw new NotFoundException("conversation not found");
        return conversation;
    }

    private String requireText(String value, String field, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new BadRequestException(field + " is required and must be at most " + maxLength + " characters");
        }
        return normalized;
    }
}
