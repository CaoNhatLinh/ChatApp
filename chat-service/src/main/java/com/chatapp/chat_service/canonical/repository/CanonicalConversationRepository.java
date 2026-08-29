package com.chatapp.chat_service.canonical.repository;

import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import java.util.EnumSet;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/** Typed CQL access for canonical membership and custom conversation roles. */
@Repository
public class CanonicalConversationRepository {
    private final CqlSession session;
    private final PreparedStatement selectMember;
    private final PreparedStatement selectMembers;
    private final PreparedStatement selectRoles;
    private final PreparedStatement selectCustomRoleCount;
    private final PreparedStatement initializeRoleCatalog;
    private final PreparedStatement upsertRole;
    private final PreparedStatement createCustomRole;
    private final PreparedStatement markRoleDeleting;
    private final PreparedStatement restoreRoleActive;
    private final PreparedStatement markRoleUpdating;
    private final PreparedStatement updateRoleAndActivate;
    private final PreparedStatement restoreUpdatingRole;
    private final PreparedStatement deleteCustomRole;

    public CanonicalConversationRepository(CqlSession session) {
        this.session = session;
        this.selectMember = session.prepare("""
                SELECT conversation_id, user_id, role_ids, joined_at, invited_by, muted_until,
                       message_interval_seconds, notification_override, last_read_message_id, last_read_at
                FROM conversation_members_by_conversation
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.selectMembers = session.prepare("""
                SELECT conversation_id, user_id, role_ids, joined_at, invited_by, muted_until,
                       message_interval_seconds, notification_override, last_read_message_id, last_read_at
                FROM conversation_members_by_conversation WHERE conversation_id = ?
                """);
        this.selectRoles = session.prepare("""
                SELECT conversation_id, role_position, role_id, role_code, display_name,
                       color_hex, permission_codes, is_default, is_system, lifecycle_state, created_by,
                       created_at, updated_at
                FROM conversation_roles_by_conversation WHERE conversation_id = ?
                """);
        this.selectCustomRoleCount = session.prepare("""
                SELECT DISTINCT custom_role_count
                FROM conversation_roles_by_conversation WHERE conversation_id = ?
                """);
        this.initializeRoleCatalog = session.prepare("""
                UPDATE conversation_roles_by_conversation SET custom_role_count = 0
                WHERE conversation_id = ? IF custom_role_count = null
                """);
        this.upsertRole = session.prepare("""
                INSERT INTO conversation_roles_by_conversation
                (conversation_id, role_code, role_id, role_position, display_name, color_hex,
                 permission_codes, is_default, is_system, lifecycle_state, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
                """);
        this.createCustomRole = session.prepare("""
                BEGIN BATCH
                UPDATE conversation_roles_by_conversation SET custom_role_count = ?
                WHERE conversation_id = ? IF custom_role_count = ?;
                INSERT INTO conversation_roles_by_conversation
                (conversation_id, role_code, role_id, role_position, display_name, color_hex,
                 permission_codes, is_default, is_system, lifecycle_state, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, 'ACTIVE', ?, ?, ?) IF NOT EXISTS;
                APPLY BATCH
                """);
        this.markRoleDeleting = session.prepare("""
                UPDATE conversation_roles_by_conversation SET lifecycle_state = 'DELETING'
                WHERE conversation_id = ? AND role_code = ?
                IF role_id = ? AND lifecycle_state = 'ACTIVE' AND is_system = false
                """);
        this.restoreRoleActive = session.prepare("""
                UPDATE conversation_roles_by_conversation SET lifecycle_state = 'ACTIVE'
                WHERE conversation_id = ? AND role_code = ? IF role_id = ? AND lifecycle_state = 'DELETING'
                """);
        this.markRoleUpdating = session.prepare("""
                UPDATE conversation_roles_by_conversation SET lifecycle_state = 'UPDATING'
                WHERE conversation_id = ? AND role_code = ?
                IF role_id = ? AND lifecycle_state = 'ACTIVE' AND is_system = false AND updated_at = ?
                """);
        this.updateRoleAndActivate = session.prepare("""
                UPDATE conversation_roles_by_conversation
                SET role_position = ?, display_name = ?, color_hex = ?, permission_codes = ?,
                    is_default = ?, updated_at = ?, lifecycle_state = 'ACTIVE'
                WHERE conversation_id = ? AND role_code = ?
                IF role_id = ? AND lifecycle_state = 'UPDATING'
                """);
        this.restoreUpdatingRole = session.prepare("""
                UPDATE conversation_roles_by_conversation SET lifecycle_state = 'ACTIVE'
                WHERE conversation_id = ? AND role_code = ? IF role_id = ? AND lifecycle_state = 'UPDATING'
                """);
        this.deleteCustomRole = session.prepare("""
                BEGIN BATCH
                UPDATE conversation_roles_by_conversation SET custom_role_count = ?
                WHERE conversation_id = ? IF custom_role_count = ?;
                DELETE FROM conversation_roles_by_conversation
                WHERE conversation_id = ? AND role_code = ? IF role_id = ? AND lifecycle_state = 'DELETING';
                APPLY BATCH
                """);
    }

    public ConversationMember findMember(UUID conversationId, UUID userId) {
        Row row = session.execute(selectMember.bind(conversationId, userId)).one();
        return row == null ? null : memberFromRow(row);
    }

    public List<ConversationMember> findMembers(UUID conversationId) {
        return session.execute(selectMembers.bind(conversationId)).all().stream()
                .map(this::memberFromRow)
                .toList();
    }

    private ConversationMember memberFromRow(Row row) {
        return new ConversationMember(
                row.getUuid("conversation_id"), row.getUuid("user_id"),
                row.getSet("role_ids", UUID.class), row.getInstant("joined_at"),
                row.getUuid("invited_by"), row.getInstant("muted_until"),
                row.isNull("message_interval_seconds") ? null : row.getInt("message_interval_seconds"),
                row.getString("notification_override"), row.getUuid("last_read_message_id"),
                row.getInstant("last_read_at"));
    }

    public List<ConversationRole> findRoles(UUID conversationId) {
        return session.execute(selectRoles.bind(conversationId)).all().stream()
                .filter(row -> "ACTIVE".equals(row.getString("lifecycle_state")))
                .map(this::roleFromRow)
                .sorted(Comparator.comparingInt(ConversationRole::rolePosition).reversed())
                .toList();
    }

    public void initializeRoleCatalog(UUID conversationId) {
        if (!session.execute(initializeRoleCatalog.bind(conversationId)).wasApplied()) {
            throw new IllegalStateException("conversation role catalog is already initialized");
        }
    }

    public int findCustomRoleCount(UUID conversationId) {
        Row row = session.execute(selectCustomRoleCount.bind(conversationId)).one();
        if (row == null || row.isNull("custom_role_count")) {
            throw new IllegalStateException("conversation role catalog state is missing");
        }
        return row.getInt("custom_role_count");
    }

    public void saveSystemRole(ConversationRole role) {
        if (!role.isSystem()) {
            throw new IllegalArgumentException("custom roles require conditional catalog creation");
        }
        Set<String> permissions = role.permissions().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());
        session.execute(upsertRole.bind(role.conversationId(), role.roleCode(), role.roleId(), role.rolePosition(),
                role.displayName(), role.colorHex(), permissions, role.isDefault(),
                role.isSystem(), role.createdBy(), role.createdAt(), role.updatedAt()));
    }

    public boolean createCustomRole(ConversationRole role, int expectedCount) {
        Set<String> permissions = role.permissions().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());
        return session.execute(createCustomRole.bind(
                expectedCount + 1, role.conversationId(), expectedCount,
                role.conversationId(), role.roleCode(), role.roleId(), role.rolePosition(), role.displayName(),
                role.colorHex(), permissions, role.isDefault(), role.createdBy(), role.createdAt(), role.updatedAt()))
                .wasApplied();
    }

    public boolean markRoleDeleting(ConversationRole role) {
        return session.execute(markRoleDeleting.bind(
                role.conversationId(), role.roleCode(), role.roleId())).wasApplied();
    }

    public void restoreRoleActive(ConversationRole role) {
        if (!session.execute(restoreRoleActive.bind(
                role.conversationId(), role.roleCode(), role.roleId())).wasApplied()) {
            throw new IllegalStateException("conversation role deletion state changed concurrently");
        }
    }

    public boolean markRoleUpdating(ConversationRole role, java.time.Instant expectedUpdatedAt) {
        return session.execute(markRoleUpdating.bind(
                role.conversationId(), role.roleCode(), role.roleId(), expectedUpdatedAt)).wasApplied();
    }

    public boolean updateRoleAndActivate(ConversationRole role) {
        Set<String> permissions = role.permissions().stream().map(Enum::name)
                .collect(java.util.stream.Collectors.toSet());
        return session.execute(updateRoleAndActivate.bind(
                role.rolePosition(), role.displayName(), role.colorHex(), permissions, role.isDefault(),
                role.updatedAt(), role.conversationId(), role.roleCode(), role.roleId())).wasApplied();
    }

    public void restoreUpdatingRole(ConversationRole role) {
        if (!session.execute(restoreUpdatingRole.bind(
                role.conversationId(), role.roleCode(), role.roleId())).wasApplied()) {
            throw new IllegalStateException("conversation role update state changed concurrently");
        }
    }

    public boolean deleteCustomRole(ConversationRole role, int expectedCount) {
        if (expectedCount <= 0) {
            throw new IllegalStateException("conversation custom role count is invalid");
        }
        return session.execute(deleteCustomRole.bind(
                expectedCount - 1, role.conversationId(), expectedCount,
                role.conversationId(), role.roleCode(), role.roleId())).wasApplied();
    }

    private ConversationRole roleFromRow(Row row) {
        Set<ConversationPermission> permissions = EnumSet.noneOf(ConversationPermission.class);
        for (String permission : row.getSet("permission_codes", String.class)) {
            permissions.add(ConversationPermission.valueOf(permission));
        }
        return new ConversationRole(row.getUuid("conversation_id"), row.getInt("role_position"),
                row.getUuid("role_id"), row.getString("role_code"), row.getString("display_name"),
                row.getString("color_hex"), permissions, row.getBoolean("is_default"),
                row.getBoolean("is_system"), row.getUuid("created_by"),
                row.getInstant("created_at"), row.getInstant("updated_at"));
    }
}
