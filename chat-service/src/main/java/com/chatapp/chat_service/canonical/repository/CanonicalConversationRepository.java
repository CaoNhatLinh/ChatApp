package com.chatapp.chat_service.canonical.repository;

import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import java.util.EnumSet;
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
    private final PreparedStatement upsertRole;
    private final PreparedStatement deleteRole;

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
                       color_hex, permission_codes, is_default, is_system, created_by,
                       created_at, updated_at
                FROM conversation_roles_by_conversation WHERE conversation_id = ?
                """);
        this.upsertRole = session.prepare("""
                INSERT INTO conversation_roles_by_conversation
                (conversation_id, role_position, role_id, role_code, display_name, color_hex,
                 permission_codes, is_default, is_system, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.deleteRole = session.prepare("""
                DELETE FROM conversation_roles_by_conversation
                WHERE conversation_id = ? AND role_position = ? AND role_id = ?
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
                .map(this::roleFromRow)
                .toList();
    }

    public void saveRole(ConversationRole role) {
        Set<String> permissions = role.permissions().stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());
        session.execute(upsertRole.bind(role.conversationId(), role.rolePosition(), role.roleId(),
                role.roleCode(), role.displayName(), role.colorHex(), permissions, role.isDefault(),
                role.isSystem(), role.createdBy(), role.createdAt(), role.updatedAt()));
    }

    public void deleteRole(ConversationRole role) {
        session.execute(deleteRole.bind(role.conversationId(), role.rolePosition(), role.roleId()));
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
