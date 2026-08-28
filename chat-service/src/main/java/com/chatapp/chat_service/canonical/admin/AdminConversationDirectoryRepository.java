package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/** Bounded, operator-only room projection; never scans conversations_by_id. */
@Repository
public class AdminConversationDirectoryRepository {
    private final CqlSession session;
    private final PreparedStatement upsert;
    private final PreparedStatement listByMonth;
    private final PreparedStatement loadConversation;
    private final PreparedStatement listMembers;
    private final PreparedStatement updatePolicy;
    private final PreparedStatement archive;

    public AdminConversationDirectoryRepository(CqlSession session) {
        this.session = session;
        this.upsert = session.prepare("""
                INSERT INTO admin_conversations_by_month
                    (month, created_at, conversation_id, conversation_type, visibility, join_policy,
                     name, description, owner_id, member_count, chat_mode, slow_mode_seconds,
                     is_deleted, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listByMonth = session.prepare("""
                SELECT * FROM admin_conversations_by_month
                WHERE month = ? LIMIT ?
                """);
        this.loadConversation = session.prepare("SELECT * FROM conversations_by_id WHERE conversation_id = ?");
        this.listMembers = session.prepare("""
                SELECT user_id, joined_at, muted_until, message_interval_seconds
                FROM conversation_members_by_conversation WHERE conversation_id = ? LIMIT ?
                """);
        this.updatePolicy = session.prepare("""
                UPDATE conversations_by_id SET chat_mode = ?, slow_mode_seconds = ?, updated_at = ?
                WHERE conversation_id = ?
                """);
        this.archive = session.prepare("""
                UPDATE conversations_by_id SET is_deleted = ?, deleted_at = ?, updated_at = ?
                WHERE conversation_id = ?
                """);
    }

    public void index(CanonicalConversation conversation) {
        if (conversation.createdAt() == null) {
            throw new IllegalStateException("canonical conversation createdAt is required");
        }
        Instant createdAt = conversation.createdAt();
        session.execute(upsert.bind(
                month(createdAt), createdAt, conversation.conversationId(), conversation.conversationType(),
                conversation.visibility(), conversation.joinPolicy(), conversation.name(), conversation.description(),
                conversation.ownerId(), conversation.memberCount(), conversation.chatMode(), conversation.slowModeSeconds(),
                Boolean.TRUE.equals(conversation.isDeleted()), conversation.updatedAt()));
    }

    public List<AdminConversationSummary> list(String requestedMonth, int requestedLimit) {
        String selectedMonth = requestedMonth == null || requestedMonth.isBlank()
                ? month(Instant.now()) : requestedMonth;
        int limit = Math.max(1, Math.min(requestedLimit, 200));
        return session.execute(listByMonth.bind(selectedMonth, limit)).all().stream()
                .map(this::mapSummary)
                .toList();
    }

    public AdminConversationSummary find(UUID conversationId) {
        Row row = session.execute(loadConversation.bind(conversationId)).one();
        if (row == null) throw new NotFoundException("conversation not found");
        return new AdminConversationSummary(
                row.getUuid("conversation_id"), row.getString("conversation_type"), row.getString("visibility"),
                row.getString("join_policy"), row.getString("name"), row.getString("description"),
                row.getUuid("owner_id"), row.getInt("member_count"), row.getString("chat_mode"),
                row.getInt("slow_mode_seconds"), row.getBoolean("is_deleted"), row.getInstant("created_at"),
                row.getInstant("updated_at"), List.of());
    }

    public AdminConversationSummary detail(UUID conversationId, int requestedLimit) {
        AdminConversationSummary summary = find(conversationId);
        int limit = Math.max(1, Math.min(requestedLimit, 500));
        List<AdminMemberSummary> members = session.execute(listMembers.bind(conversationId, limit)).all().stream()
                .map(row -> new AdminMemberSummary(
                        row.getUuid("user_id"), row.getInstant("joined_at"), row.getInstant("muted_until"),
                        row.getInt("message_interval_seconds")))
                .toList();
        return summary.withMembers(members);
    }

    public AdminConversationSummary updateChatPolicy(UUID conversationId, String chatMode, int slowModeSeconds) {
        AdminConversationSummary current = find(conversationId);
        Instant updatedAt = Instant.now();
        session.execute(updatePolicy.bind(chatMode, slowModeSeconds, updatedAt, conversationId));
        upsert(current.withPolicy(chatMode, slowModeSeconds, updatedAt));
        return detail(conversationId, 500);
    }

    public AdminConversationSummary setArchived(UUID conversationId, boolean archived) {
        AdminConversationSummary current = find(conversationId);
        Instant now = Instant.now();
        session.execute(archive.bind(archived, archived ? now : null, now, conversationId));
        upsert(current.withArchived(archived, now));
        return detail(conversationId, 500);
    }

    private AdminConversationSummary mapSummary(Row row) {
        return new AdminConversationSummary(
                row.getUuid("conversation_id"), row.getString("conversation_type"), row.getString("visibility"),
                row.getString("join_policy"), row.getString("name"), row.getString("description"),
                row.getUuid("owner_id"), row.getInt("member_count"), row.getString("chat_mode"),
                row.getInt("slow_mode_seconds"), row.getBoolean("is_deleted"), row.getInstant("created_at"),
                row.getInstant("updated_at"), List.of());
    }

    private void upsert(AdminConversationSummary summary) {
        session.execute(upsert.bind(
                month(summary.createdAt()), summary.createdAt(), summary.conversationId(), summary.conversationType(),
                summary.visibility(), summary.joinPolicy(), summary.name(), summary.description(), summary.ownerId(),
                summary.memberCount(), summary.chatMode(), summary.slowModeSeconds(), summary.deleted(), summary.updatedAt()));
    }

    private static String month(Instant instant) {
        return YearMonth.from(instant.atZone(ZoneOffset.UTC)).toString();
    }

    public record AdminConversationSummary(
            UUID conversationId,
            String conversationType,
            String visibility,
            String joinPolicy,
            String name,
            String description,
            UUID ownerId,
            Integer memberCount,
            String chatMode,
            Integer slowModeSeconds,
            Boolean deleted,
            Instant createdAt,
            Instant updatedAt,
            List<AdminMemberSummary> members) {
        AdminConversationSummary withMembers(List<AdminMemberSummary> nextMembers) {
            return new AdminConversationSummary(conversationId, conversationType, visibility, joinPolicy, name,
                    description, ownerId, memberCount, chatMode, slowModeSeconds, deleted, createdAt, updatedAt, nextMembers);
        }

        AdminConversationSummary withPolicy(String nextChatMode, int nextSlowModeSeconds, Instant nextUpdatedAt) {
            return new AdminConversationSummary(conversationId, conversationType, visibility, joinPolicy, name,
                    description, ownerId, memberCount, nextChatMode, nextSlowModeSeconds, deleted, createdAt, nextUpdatedAt, members);
        }

        AdminConversationSummary withArchived(boolean nextDeleted, Instant nextUpdatedAt) {
            return new AdminConversationSummary(conversationId, conversationType, visibility, joinPolicy, name,
                    description, ownerId, memberCount, chatMode, slowModeSeconds, nextDeleted, createdAt, nextUpdatedAt, members);
        }
    }

    public record AdminMemberSummary(UUID userId, Instant joinedAt, Instant mutedUntil, Integer messageIntervalSeconds) {
    }
}
