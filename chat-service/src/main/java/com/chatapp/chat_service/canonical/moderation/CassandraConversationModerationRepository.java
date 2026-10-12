package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.UUID;
import java.util.List;

@Repository
public class CassandraConversationModerationRepository implements ConversationModerationRepository {
    private final CqlSession session;
    private final PreparedStatement saveBan;
    private final PreparedStatement saveBanByUser;
    private final PreparedStatement findBan;
    private final PreparedStatement deleteBan;
    private final PreparedStatement deleteBanByUser;
    private final PreparedStatement deleteBanIfExpiryMatches;
    private final PreparedStatement deleteBanByUserIfExpiryMatches;
    private final PreparedStatement clearMuteIfExpiryMatches;
    private final PreparedStatement listBans;

    public CassandraConversationModerationRepository(CqlSession session) {
        this.session = session;
        this.saveBan = session.prepare("""
                INSERT INTO conversation_bans_by_conversation
                    (conversation_id, user_id, banned_by, reason_code, reason_text, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, toTimestamp(now()), ?)
                """);
        this.saveBanByUser = session.prepare("""
                INSERT INTO conversation_bans_by_user
                    (user_id, conversation_id, banned_by, reason_code, created_at, expires_at)
                VALUES (?, ?, ?, ?, toTimestamp(now()), ?)
                """);
        this.findBan = session.prepare("""
                SELECT expires_at FROM conversation_bans_by_conversation
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.deleteBan = session.prepare("""
                DELETE FROM conversation_bans_by_conversation WHERE conversation_id = ? AND user_id = ?
                """);
        this.deleteBanByUser = session.prepare("""
                DELETE FROM conversation_bans_by_user WHERE user_id = ? AND conversation_id = ?
                """);
        this.deleteBanIfExpiryMatches = session.prepare("""
                DELETE FROM conversation_bans_by_conversation
                WHERE conversation_id = ? AND user_id = ? IF expires_at = ?
                """);
        this.deleteBanByUserIfExpiryMatches = session.prepare("""
                DELETE FROM conversation_bans_by_user
                WHERE user_id = ? AND conversation_id = ? IF expires_at = ?
                """);
        this.clearMuteIfExpiryMatches = session.prepare("""
                UPDATE conversation_members_by_conversation SET muted_until = null
                WHERE conversation_id = ? AND user_id = ? IF muted_until = ?
                """);
        this.listBans = session.prepare("""
                SELECT conversation_id, user_id, banned_by, reason_code, reason_text, created_at, expires_at
                FROM conversation_bans_by_conversation WHERE conversation_id = ? LIMIT ?
                """);
    }

    @Override public void ban(UUID conversationId, UUID userId, UUID by, String code, String text, Instant expiry) {
        session.execute(saveBan.bind(conversationId, userId, by, code, text, expiry));
        session.execute(saveBanByUser.bind(userId, conversationId, by, code, expiry));
    }
    @Override public boolean isBanned(UUID conversationId, UUID userId, Instant now) {
        var row = session.execute(findBan.bind(conversationId, userId)).one();
        if (row == null) return false;
        Instant expiry = row.getInstant("expires_at");
        return expiry == null || expiry.isAfter(now);
    }
    @Override public void clearBan(UUID conversationId, UUID userId) {
        session.execute(deleteBan.bind(conversationId, userId));
        session.execute(deleteBanByUser.bind(userId, conversationId));
    }
    @Override public boolean clearBanIfUnchanged(UUID conversationId, UUID userId, Instant expiry) {
        if (expiry == null || !session.execute(deleteBanIfExpiryMatches.bind(conversationId, userId, expiry)).wasApplied()) {
            return false;
        }
        session.execute(deleteBanByUserIfExpiryMatches.bind(userId, conversationId, expiry));
        return true;
    }
    @Override public boolean clearMuteIfUnchanged(UUID conversationId, UUID userId, Instant expiry) {
        return expiry != null && session.execute(
                clearMuteIfExpiryMatches.bind(conversationId, userId, expiry)).wasApplied();
    }
    @Override public List<ConversationBan> listBans(UUID conversationId, Instant now, int limit) {
        return session.execute(listBans.bind(conversationId, Math.max(1, Math.min(limit, 100))))
                .all().stream()
                .map(row -> new ConversationBan(
                        row.getUuid("conversation_id"), row.getUuid("user_id"), row.getUuid("banned_by"),
                        row.getString("reason_code"), row.getString("reason_text"), row.getInstant("created_at"),
                        row.getInstant("expires_at")))
                .filter(ban -> ban.expiresAt() == null || ban.expiresAt().isAfter(now))
                .toList();
    }
}
