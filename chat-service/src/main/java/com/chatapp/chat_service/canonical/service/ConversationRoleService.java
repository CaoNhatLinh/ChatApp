package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.ConversationRoleCreateRequest;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.ConversationRoleUpdateRequest;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.HashSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ConversationRoleService {

    private static final Pattern ROLE_CODE = Pattern.compile("[A-Z][A-Z0-9_]{1,31}");
    private static final Pattern COLOR = Pattern.compile("#[0-9A-Fa-f]{6}");
    private static final int MAX_CUSTOM_ROLES = 50;

    private final CanonicalCqlStore store;
    private final CanonicalConversationRepository repository;
    private final ConversationAuthorizationService authorization;
    private final CanonicalEventRecorder events;
    private final AdminConversationDirectoryRepository adminDirectory;

    public ConversationRoleService(
            CanonicalCqlStore store,
            CanonicalConversationRepository repository,
            ConversationAuthorizationService authorization,
            CanonicalEventRecorder events,
            AdminConversationDirectoryRepository adminDirectory) {
        this.store = store;
        this.repository = repository;
        this.authorization = authorization;
        this.events = events;
        this.adminDirectory = adminDirectory;
    }

    public List<ConversationRole> list(UUID actorId, UUID conversationId) {
        authorization.requireMember(conversationId, actorId);
        requireRoleEnabledConversation(conversationId);
        return repository.findRoles(conversationId);
    }

    public CanonicalApiContracts.ConversationPermissionsView permissions(
            UUID actorId,
            UUID conversationId) {
        CanonicalConversation conversation = requireRoleEnabledConversation(conversationId);
        Set<String> permissions = authorization.effectivePermissions(conversationId, actorId).stream()
                .map(Enum::name)
                .collect(Collectors.toUnmodifiableSet());
        return new CanonicalApiContracts.ConversationPermissionsView(
                permissions, actorId.equals(conversation.ownerId()));
    }

    public ConversationRole create(UUID actorId, UUID conversationId, ConversationRoleCreateRequest request) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROLE_CREATE);
        requireRoleEnabledConversation(conversationId);
        List<ConversationRole> existing = repository.findRoles(conversationId);
        int customRoleCount = repository.findCustomRoleCount(conversationId);
        if (customRoleCount >= MAX_CUSTOM_ROLES) {
            throw new ConflictException("custom role limit reached");
        }

        String roleCode = normalizeRoleCode(request.roleCode());
        if (existing.stream().anyMatch(role -> role.roleCode().equals(roleCode))) {
            throw new ConflictException("role code already exists");
        }
        Set<ConversationPermission> requestedPermissions = parsePermissions(request.permissionCodes());
        if (!authorization.effectivePermissions(conversationId, actorId).containsAll(requestedPermissions)) {
            throw new BadRequestException("cannot grant permissions the actor does not have");
        }

        int position = request.rolePosition() == null
                ? existing.stream()
                        .filter(role -> !"OWNER".equals(role.roleCode()))
                        .mapToInt(ConversationRole::rolePosition).max().orElse(1) + 10
                : request.rolePosition();
        validatePresentation(request.displayName(), request.colorHex(), position);
        Instant now = Instant.now();
        ConversationRole role = new ConversationRole(
                conversationId, position, UUID.randomUUID(), roleCode, request.displayName().trim(),
                request.colorHex().toUpperCase(Locale.ROOT), requestedPermissions,
                Boolean.TRUE.equals(request.isDefault()), false, actorId, now, now);
        if (!repository.createCustomRole(role, customRoleCount)) {
            List<ConversationRole> current = repository.findRoles(conversationId);
            if (current.stream().anyMatch(item -> item.roleCode().equals(roleCode))) {
                throw new ConflictException("role code already exists");
            }
            if (repository.findCustomRoleCount(conversationId) >= MAX_CUSTOM_ROLES) {
                throw new ConflictException("custom role limit reached");
            }
            throw new ConflictException("conversation role catalog changed concurrently");
        }
        events.record(actorId, conversationId, "ROLE_CREATED", "conversation_role", role.roleId().toString(),
                null, null, Map.of(), Map.of("roleCode", roleCode, "colorHex", role.colorHex()));
        return role;
    }

    public void delete(UUID actorId, UUID conversationId, UUID roleId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROLE_DELETE);
        requireRoleEnabledConversation(conversationId);
        ConversationRole role = findRole(conversationId, roleId);
        if (role.isSystem()) {
            throw new ConflictException("system roles cannot be deleted");
        }
        if (!repository.markRoleDeleting(role)) {
            throw new ConflictException("conversation role changed concurrently");
        }
        boolean deleted = false;
        try {
            long roleRevision = store.requireConversationRoleRevision(conversationId);
            if (!store.advanceConversationRoleRevision(conversationId, roleRevision)) {
                throw new ConflictException("conversation roles changed concurrently");
            }
            boolean assigned = repository.findMembers(conversationId).stream()
                    .map(ConversationMember::roleIds)
                    .anyMatch(roleIds -> roleIds != null && roleIds.contains(roleId));
            if (assigned) {
                throw new ConflictException("role is assigned to conversation members");
            }
            for (int attempt = 0; attempt <= MAX_CUSTOM_ROLES; attempt++) {
                int customRoleCount = repository.findCustomRoleCount(conversationId);
                if (repository.deleteCustomRole(role, customRoleCount)) {
                    deleted = true;
                    break;
                }
            }
            if (!deleted) {
                throw new ConflictException("conversation role catalog changed concurrently");
            }
        } finally {
            if (!deleted) {
                repository.restoreRoleActive(role);
            }
        }
        events.record(actorId, conversationId, "ROLE_DELETED", "conversation_role", roleId.toString(),
                null, null, Map.of("roleCode", role.roleCode()), Map.of());
    }

    public ConversationRole update(
            UUID actorId,
            UUID conversationId,
            UUID roleId,
            ConversationRoleUpdateRequest request) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROLE_UPDATE);
        requireRoleEnabledConversation(conversationId);
        ConversationRole original = findRole(conversationId, roleId);
        if (original.isSystem()) {
            throw new ConflictException("system roles cannot be updated");
        }
        validatePresentation(request.displayName(), request.colorHex(), request.rolePosition());
        Set<ConversationPermission> requestedPermissions = parsePermissions(request.permissionCodes());
        if (!authorization.effectivePermissions(conversationId, actorId).containsAll(requestedPermissions)) {
            throw new BadRequestException("cannot grant permissions the actor does not have");
        }
        if (!original.updatedAt().equals(request.expectedUpdatedAt())
                || !repository.markRoleUpdating(original, request.expectedUpdatedAt())) {
            throw new ConflictException("conversation role changed concurrently");
        }

        Instant now = Instant.now();
        ConversationRole updated = new ConversationRole(
                conversationId, request.rolePosition(), original.roleId(), original.roleCode(),
                request.displayName().trim(), request.colorHex().toUpperCase(Locale.ROOT), requestedPermissions,
                request.isDefault(), false, original.createdBy(), original.createdAt(), now);
        boolean saved = false;
        try {
            long roleRevision = store.requireConversationRoleRevision(conversationId);
            if (!store.advanceConversationRoleRevision(conversationId, roleRevision)) {
                throw new ConflictException("conversation role authority changed concurrently");
            }
            if (!repository.updateRoleAndActivate(updated)) {
                throw new ConflictException("conversation role changed concurrently");
            }
            saved = true;
        } finally {
            if (!saved) {
                repository.restoreUpdatingRole(original);
            }
        }
        events.record(actorId, conversationId, "ROLE_UPDATED", "conversation_role", roleId.toString(),
                null, null,
                Map.of("displayName", original.displayName(), "colorHex", original.colorHex(),
                        "permissions", original.permissions().toString(),
                        "isDefault", Boolean.toString(original.isDefault()),
                        "rolePosition", Integer.toString(original.rolePosition())),
                Map.of("displayName", updated.displayName(), "colorHex", updated.colorHex(),
                        "permissions", updated.permissions().toString(),
                        "isDefault", Boolean.toString(updated.isDefault()),
                        "rolePosition", Integer.toString(updated.rolePosition())));
        return updated;
    }

    public void assign(UUID actorId, UUID conversationId, UUID targetUserId, Set<UUID> roleIds) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROLE_ASSIGN);
        CanonicalConversation conversation = requireRoleEnabledConversation(conversationId);
        if (targetUserId.equals(conversation.ownerId())) {
            throw new ConflictException("owner roles change only through ownership transfer");
        }
        if (roleIds == null || roleIds.size() > 20) {
            throw new BadRequestException("roleIds must contain at most 20 roles");
        }
        ConversationMember target = repository.findMember(conversationId, targetUserId);
        if (target == null) {
            throw new BadRequestException("target user is not a conversation member");
        }
        long roleRevision = store.requireConversationRoleRevision(conversationId);
        List<ConversationRole> roles = repository.findRoles(conversationId);
        List<ConversationRole> selected = roles.stream().filter(role -> roleIds.contains(role.roleId())).toList();
        if (selected.size() != roleIds.size()) {
            throw new BadRequestException("one or more roleIds do not belong to the conversation");
        }
        if (selected.stream().anyMatch(role -> role.isSystem() && "OWNER".equals(role.roleCode()))) {
            throw new BadRequestException("OWNER role can only be granted by ownership transfer");
        }
        Set<ConversationPermission> actorPermissions = authorization.effectivePermissions(conversationId, actorId);
        boolean overGrant = selected.stream().map(ConversationRole::permissions)
                .anyMatch(permissions -> !actorPermissions.containsAll(permissions));
        if (overGrant) {
            throw new BadRequestException("cannot assign a role with permissions the actor does not have");
        }

        Set<UUID> previous = target.roleIds() == null ? Set.of() : target.roleIds();
        ConversationMember updated = new ConversationMember(
                target.conversationId(), target.userId(), Set.copyOf(roleIds), target.joinedAt(), target.invitedBy(),
                target.mutedUntil(), target.messageIntervalSeconds(), target.notificationOverride(),
                target.lastReadMessageId(), target.lastReadAt());
        if (!store.updateMemberRolesIfUnchanged(
                conversationId, targetUserId, previous, updated.roleIds(), roleRevision)) {
            throw new ConflictException("conversation member roles changed concurrently");
        }
        store.updateConversationProjectionRoles(targetUserId, conversationId, updated.roleIds());
        events.record(actorId, conversationId, "ROLES_ASSIGNED", "conversation_member", targetUserId.toString(),
                targetUserId, null, Map.of("roleIds", previous.toString()), Map.of("roleIds", roleIds.toString()));
    }

    public void transferOwnership(UUID actorId, UUID conversationId, UUID targetUserId) {
        CanonicalConversation conversation = requireRoleEnabledConversation(conversationId);
        authorization.requireMember(conversationId, actorId);
        if (actorId.equals(targetUserId)) {
            throw new BadRequestException("target user is already the owner");
        }
        ConversationMember currentOwner = repository.findMember(conversationId, actorId);
        ConversationMember nextOwner = repository.findMember(conversationId, targetUserId);
        if (nextOwner == null) {
            throw new BadRequestException("target user is not a conversation member");
        }
        if (targetUserId.equals(conversation.ownerId())) {
            repairOwnershipProjections(conversationId, currentOwner, nextOwner);
            return;
        }
        if (!actorId.equals(conversation.ownerId())) {
            throw new ForbiddenException("only the current owner can transfer ownership");
        }

        long roleRevision = store.requireConversationRoleRevision(conversationId);
        List<ConversationRole> roles = repository.findRoles(conversationId);
        UUID ownerRoleId = roles.stream()
                .filter(role -> role.isSystem() && "OWNER".equals(role.roleCode()))
                .map(ConversationRole::roleId)
                .findFirst()
                .orElseThrow(() -> new ConflictException("OWNER system role is missing"));
        Set<UUID> defaultRoleIds = roles.stream().filter(ConversationRole::isDefault)
                .map(ConversationRole::roleId).collect(Collectors.toSet());

        Set<UUID> oldOwnerRoles = new HashSet<>(currentOwner.roleIds() == null ? Set.of() : currentOwner.roleIds());
        oldOwnerRoles.remove(ownerRoleId);
        oldOwnerRoles.addAll(defaultRoleIds);
        Set<UUID> nextOwnerRoles = new HashSet<>(nextOwner.roleIds() == null ? Set.of() : nextOwner.roleIds());
        nextOwnerRoles.add(ownerRoleId);
        CanonicalCqlStore.OwnershipTransferResult result = store.transferConversationOwnership(
                conversationId,
                roleRevision,
                actorId,
                targetUserId,
                currentOwner.roleIds() == null ? Set.of() : currentOwner.roleIds(),
                Set.copyOf(oldOwnerRoles),
                nextOwner.roleIds() == null ? Set.of() : nextOwner.roleIds(),
                Set.copyOf(nextOwnerRoles));
        if (result == CanonicalCqlStore.OwnershipTransferResult.CHANGED_CONCURRENTLY) {
            throw new ConflictException("conversation ownership or roles changed concurrently");
        }
        if (result == CanonicalCqlStore.OwnershipTransferResult.ALREADY_TRANSFERRED) {
            ConversationMember authoritativePrevious = repository.findMember(conversationId, actorId);
            ConversationMember authoritativeCurrent = repository.findMember(conversationId, targetUserId);
            if (authoritativePrevious == null || authoritativeCurrent == null) {
                throw new IllegalStateException("ownership members are missing after transfer");
            }
            repairOwnershipProjections(conversationId, authoritativePrevious, authoritativeCurrent);
            return;
        }
        repairOwnershipProjections(
                conversationId,
                withRoles(currentOwner, oldOwnerRoles),
                withRoles(nextOwner, nextOwnerRoles));
        events.record(actorId, conversationId, "OWNERSHIP_TRANSFERRED", "conversation", conversationId.toString(),
                targetUserId, null, Map.of("ownerId", actorId.toString()), Map.of("ownerId", targetUserId.toString()));
    }

    private ConversationMember withRoles(ConversationMember member, Set<UUID> roleIds) {
        return new ConversationMember(
                member.conversationId(), member.userId(), Set.copyOf(roleIds), member.joinedAt(), member.invitedBy(),
                member.mutedUntil(), member.messageIntervalSeconds(), member.notificationOverride(),
                member.lastReadMessageId(), member.lastReadAt());
    }

    private void repairOwnershipProjections(
            UUID conversationId,
            ConversationMember previousOwner,
            ConversationMember currentOwner) {
        store.updateConversationProjectionRoles(
                previousOwner.userId(), conversationId, previousOwner.roleIds());
        store.updateConversationProjectionRoles(
                currentOwner.userId(), conversationId, currentOwner.roleIds());
        CanonicalConversation current = store.findConversation(conversationId);
        if (current == null) {
            throw new IllegalStateException("conversation is missing after ownership transfer");
        }
        adminDirectory.index(current);
    }

    private ConversationRole findRole(UUID conversationId, UUID roleId) {
        return repository.findRoles(conversationId).stream()
                .filter(role -> role.roleId().equals(roleId))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("conversation role not found"));
    }

    private CanonicalConversation requireRoleEnabledConversation(UUID conversationId) {
        CanonicalConversation conversation = store.findConversation(conversationId);
        if (conversation == null) {
            throw new BadRequestException("conversation not found");
        }
        if ("DM".equals(conversation.conversationType())) {
            throw new BadRequestException("direct messages do not have conversation roles");
        }
        return conversation;
    }

    private String normalizeRoleCode(String roleCode) {
        String normalized = roleCode == null ? "" : roleCode.trim().toUpperCase(Locale.ROOT);
        if (!ROLE_CODE.matcher(normalized).matches()) {
            throw new BadRequestException("roleCode must match " + ROLE_CODE.pattern());
        }
        return normalized;
    }

    private Set<ConversationPermission> parsePermissions(Set<String> permissionCodes) {
        if (permissionCodes == null || permissionCodes.isEmpty()) {
            return Set.of();
        }
        try {
            return permissionCodes.stream()
                    .map(code -> ConversationPermission.valueOf(code.trim().toUpperCase(Locale.ROOT)))
                    .collect(Collectors.toCollection(() -> EnumSet.noneOf(ConversationPermission.class)));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("unknown conversation permission");
        }
    }

    private void validatePresentation(String displayName, String colorHex, int position) {
        if (displayName == null || displayName.isBlank() || displayName.length() > 64) {
            throw new BadRequestException("role displayName must contain 1 to 64 characters");
        }
        if (colorHex == null || !COLOR.matcher(colorHex).matches()) {
            throw new BadRequestException("colorHex must use #RRGGBB");
        }
        if (position < 1 || position > 10_000) {
            throw new BadRequestException("rolePosition must be between 1 and 10000");
        }
    }
}
