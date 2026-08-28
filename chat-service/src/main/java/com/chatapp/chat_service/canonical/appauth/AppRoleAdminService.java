package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AppRoleAdminService {
    private static final Set<String> ROLE_CODES = Set.of(
            "SUPER_ADMIN", "APP_ADMIN", "TRUST_SAFETY", "SUPPORT", "ANALYST", "AUDITOR");

    private final AppRoleRepository roles;
    private final AppAuthorizationService authorization;
    private final CanonicalCqlStore users;
    private final CanonicalEventRecorder events;

    public AppRoleAdminService(
            AppRoleRepository roles,
            AppAuthorizationService authorization,
            CanonicalCqlStore users,
            CanonicalEventRecorder events) {
        this.roles = roles;
        this.authorization = authorization;
        this.users = users;
        this.events = events;
    }

    public List<AppRoleRepository.AppRoleGrant> list(UUID actorId, UUID userId) {
        authorization.require(actorId, AppPermission.USER_READ);
        return roles.findRoles(userId);
    }

    public AppRoleRepository.AppRoleGrant grant(
            UUID actorId, UUID userId, String requestedRoleCode, Instant expiresAt, String reason) {
        authorization.require(actorId, AppPermission.APP_ROLE_MANAGE);
        requireReason(reason);
        String roleCode = normalizeRole(requestedRoleCode);
        requireSuperAdminForSuperAdminMutation(actorId, roleCode);
        if (users.findUserById(userId) == null) {
            throw new NotFoundException("user not found");
        }
        if (roles.findRoles(userId).stream().anyMatch(role -> role.roleCode().equals(roleCode))) {
            throw new ConflictException("app role is already assigned");
        }
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            throw new BadRequestException("expiresAt must be in the future");
        }
        var grant = roles.grant(userId, roleCode, actorId, expiresAt);
        events.record(actorId, null, "APP_ROLE_GRANTED", "user", userId.toString(), userId, reason,
                Map.of(), Map.of("roleCode", roleCode));
        return grant;
    }

    public void revoke(UUID actorId, UUID userId, String requestedRoleCode, String reason) {
        authorization.require(actorId, AppPermission.APP_ROLE_MANAGE);
        requireReason(reason);
        String roleCode = normalizeRole(requestedRoleCode);
        requireSuperAdminForSuperAdminMutation(actorId, roleCode);
        if (actorId.equals(userId) && "SUPER_ADMIN".equals(roleCode)) {
            throw new ConflictException("a super administrator cannot revoke their own bootstrap role");
        }
        if (!roles.revoke(userId, roleCode)) {
            throw new NotFoundException("app role assignment not found");
        }
        events.record(actorId, null, "APP_ROLE_REVOKED", "user", userId.toString(), userId, reason,
                Map.of("roleCode", roleCode), Map.of());
    }

    public CanonicalUser updateAccountStatus(
            UUID actorId, UUID userId, String requestedStatus, String reason) {
        requireReason(reason);
        String status = requestedStatus == null ? "" : requestedStatus.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ACTIVE", "SUSPENDED", "BANNED").contains(status)) {
            throw new BadRequestException("account status must be ACTIVE, SUSPENDED, or BANNED");
        }
        if (actorId.equals(userId) && !"ACTIVE".equals(status)) {
            throw new ConflictException("an administrator cannot suspend or ban their own account");
        }
        authorization.require(actorId,
                "ACTIVE".equals(status) ? AppPermission.USER_RESTORE : AppPermission.USER_SUSPEND);
        var current = users.findUserById(userId);
        if (current == null) {
            throw new NotFoundException("user not found");
        }
        if (status.equals(current.accountStatus())) {
            return current;
        }
        var updated = users.updateUserAccountStatus(userId, status, Instant.now());
        events.record(actorId, null, "USER_ACCOUNT_STATUS_UPDATE", "user", userId.toString(), userId, reason,
                Map.of("accountStatus", String.valueOf(current.accountStatus())),
                Map.of("accountStatus", status));
        return updated;
    }

    public List<CanonicalCqlStore.RefreshTokenSessionRow> listSessions(UUID actorId, UUID userId, int limit) {
        authorization.require(actorId, AppPermission.USER_READ);
        requireUser(userId);
        return users.listRefreshTokens(userId, limit);
    }

    public void revokeSession(UUID actorId, UUID userId, UUID tokenId, String reason) {
        authorization.require(actorId, AppPermission.SESSION_REVOKE);
        requireReason(reason);
        requireUser(userId);
        if (!users.revokeRefreshTokenForUser(userId, tokenId, Instant.now())) {
            throw new NotFoundException("active session not found");
        }
        events.record(actorId, null, "USER_SESSION_REVOKED", "user", userId.toString(), userId, reason,
                Map.of("tokenId", tokenId.toString()), Map.of("revoked", "true"));
    }

    public List<CanonicalCqlStore.DeviceSessionRow> listDevices(UUID actorId, UUID userId, int limit) {
        authorization.require(actorId, AppPermission.USER_READ);
        requireUser(userId);
        return users.listDevices(userId, limit);
    }

    public void revokeDevice(UUID actorId, UUID userId, UUID deviceId, String reason) {
        authorization.require(actorId, AppPermission.SESSION_REVOKE);
        requireReason(reason);
        requireUser(userId);
        if (!users.revokeDeviceForUser(userId, deviceId, Instant.now())) {
            throw new NotFoundException("active device not found");
        }
        events.record(actorId, null, "USER_DEVICE_REVOKED", "user", userId.toString(), userId, reason,
                Map.of("deviceId", deviceId.toString()), Map.of("revoked", "true"));
    }

    private void requireUser(UUID userId) {
        if (users.findUserById(userId) == null) {
            throw new NotFoundException("user not found");
        }
    }

    private void requireSuperAdminForSuperAdminMutation(UUID actorId, String roleCode) {
        if ("SUPER_ADMIN".equals(roleCode)
                && roles.findRoles(actorId).stream().noneMatch(role -> "SUPER_ADMIN".equals(role.roleCode()))) {
            throw new BadRequestException("only a super administrator can change SUPER_ADMIN assignments");
        }
    }

    private String normalizeRole(String roleCode) {
        String normalized = roleCode == null ? "" : roleCode.trim().toUpperCase(Locale.ROOT);
        if (!ROLE_CODES.contains(normalized)) {
            throw new BadRequestException("unknown app role code");
        }
        return normalized;
    }

    private static void requireReason(String reason) {
        String normalized = reason == null ? "" : reason.trim();
        if (normalized.isBlank() || normalized.length() > 500) {
            throw new BadRequestException("reason is required and must be at most 500 characters");
        }
    }
}
