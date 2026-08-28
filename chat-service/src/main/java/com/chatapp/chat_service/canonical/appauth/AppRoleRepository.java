package com.chatapp.chat_service.canonical.appauth;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public class AppRoleRepository {
    private final CqlSession session;
    private final PreparedStatement listRoles;
    private final PreparedStatement listPermissions;
    private final PreparedStatement saveRole;
    private final PreparedStatement saveRoleProjection;
    private final PreparedStatement deleteRole;
    private final PreparedStatement deleteRoleProjection;

    public AppRoleRepository(CqlSession session) {
        this.session = session;
        this.listRoles = session.prepare("SELECT * FROM app_roles_by_user WHERE user_id = ?");
        this.listPermissions = session.prepare(
                "SELECT permission_code FROM app_permissions_by_role WHERE role_code = ?");
        this.saveRole = session.prepare("""
                INSERT INTO app_roles_by_user
                    (user_id, role_code, grant_id, granted_by, granted_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
        this.saveRoleProjection = session.prepare("""
                INSERT INTO app_role_members_by_role
                    (role_code, granted_at, user_id, grant_id, granted_by, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
        this.deleteRole = session.prepare(
                "DELETE FROM app_roles_by_user WHERE user_id = ? AND role_code = ?");
        this.deleteRoleProjection = session.prepare("""
                DELETE FROM app_role_members_by_role
                WHERE role_code = ? AND granted_at = ? AND user_id = ?
                """);
    }

    public List<AppRoleGrant> findRoles(UUID userId) {
        Instant now = Instant.now();
        return session.execute(listRoles.bind(userId)).all().stream()
                .map(this::mapGrant)
                .filter(grant -> grant.expiresAt() == null || grant.expiresAt().isAfter(now))
                .toList();
    }

    public Set<AppPermission> findPermissions(String roleCode) {
        return session.execute(listPermissions.bind(roleCode)).all().stream()
                .map(row -> AppPermission.valueOf(row.getString("permission_code")))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public AppRoleGrant grant(UUID userId, String roleCode, UUID grantedBy, Instant expiresAt) {
        UUID grantId = Uuids.timeBased();
        Instant grantedAt = Instant.ofEpochMilli(Uuids.unixTimestamp(grantId));
        session.execute(saveRole.bind(userId, roleCode, grantId, grantedBy, grantedAt, expiresAt));
        session.execute(saveRoleProjection.bind(roleCode, grantId, userId, grantId, grantedBy, expiresAt));
        return new AppRoleGrant(userId, roleCode, grantId, grantedBy, grantedAt, expiresAt);
    }

    public boolean revoke(UUID userId, String roleCode) {
        AppRoleGrant grant = findRoles(userId).stream()
                .filter(item -> item.roleCode().equals(roleCode))
                .findFirst().orElse(null);
        if (grant == null) return false;
        session.execute(deleteRole.bind(userId, roleCode));
        session.execute(deleteRoleProjection.bind(roleCode, grant.grantId(), userId));
        return true;
    }

    private AppRoleGrant mapGrant(Row row) {
        return new AppRoleGrant(
                row.getUuid("user_id"), row.getString("role_code"), row.getUuid("grant_id"),
                row.getUuid("granted_by"), row.getInstant("granted_at"), row.getInstant("expires_at"));
    }

    public record AppRoleGrant(
            UUID userId, String roleCode, UUID grantId, UUID grantedBy, Instant grantedAt, Instant expiresAt) {
    }
}
