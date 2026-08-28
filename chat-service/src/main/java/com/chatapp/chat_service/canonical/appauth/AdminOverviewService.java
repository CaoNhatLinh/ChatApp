package com.chatapp.chat_service.canonical.appauth;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Returns the server-authoritative capability snapshot used by the admin UI.
 * The frontend never infers admin access from a locally decoded JWT.
 */
@Service
public class AdminOverviewService {
    private static final List<String> AVAILABLE_ROLE_CODES = List.of(
            "SUPER_ADMIN", "APP_ADMIN", "TRUST_SAFETY", "SUPPORT", "ANALYST", "AUDITOR");
    private static final Set<AppPermission> ADMIN_PERMISSIONS = Set.of(
            AppPermission.APP_ROLE_MANAGE,
            AppPermission.USER_READ,
            AppPermission.ROOM_READ,
            AppPermission.ROOM_MODERATE,
            AppPermission.REPORT_MANAGE,
            AppPermission.AUDIT_READ,
            AppPermission.ANALYTICS_READ,
            AppPermission.EXPORT_DATA,
            AppPermission.SYSTEM_OPERATE);

    private final AppRoleRepository roles;
    private final AppAuthorizationService authorization;

    public AdminOverviewService(AppRoleRepository roles, AppAuthorizationService authorization) {
        this.roles = roles;
        this.authorization = authorization;
    }

    public AdminOverview snapshot(UUID actorId) {
        var effectivePermissions = authorization.permissions(actorId);
        if (effectivePermissions.stream().noneMatch(ADMIN_PERMISSIONS::contains)) {
            authorization.require(actorId, AppPermission.USER_READ);
        }
        return new AdminOverview(
                actorId,
                roles.findRoles(actorId).stream().map(AppRoleRepository.AppRoleGrant::roleCode).toList(),
                effectivePermissions.stream().map(Enum::name).sorted().toList(),
                AVAILABLE_ROLE_CODES);
    }

    public record AdminOverview(
            UUID actorId,
            List<String> roles,
            List<String> permissions,
            List<String> availableRoleCodes) {
    }
}
