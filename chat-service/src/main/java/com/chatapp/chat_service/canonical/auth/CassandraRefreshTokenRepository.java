package com.chatapp.chat_service.canonical.auth;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class CassandraRefreshTokenRepository implements RefreshTokenRepository {
    private final CqlSession session;
    private final PreparedStatement saveSession;
    private final PreparedStatement saveOwner;
    private final PreparedStatement findOwner;
    private final PreparedStatement revokeOwner;
    private final PreparedStatement findSessions;
    private final PreparedStatement revokeSession;

    public CassandraRefreshTokenRepository(CqlSession session) {
        this.session = session;
        this.saveSession = session.prepare("""
                INSERT INTO refresh_tokens_by_user
                    (user_id, issued_at, token_id, token_hash, device_id, expires_at, revoked_at, replaced_by_token_id)
                VALUES (?, ?, ?, ?, ?, ?, null, null)
                """);
        this.saveOwner = session.prepare("""
                INSERT INTO refresh_token_owner_by_id (token_id, user_id, token_hash, expires_at, revoked_at)
                VALUES (?, ?, ?, ?, null)
                """);
        this.findOwner = session.prepare("""
                SELECT token_id, user_id, token_hash, expires_at, revoked_at
                FROM refresh_token_owner_by_id WHERE token_id = ?
                """);
        this.revokeOwner = session.prepare("""
                UPDATE refresh_token_owner_by_id SET revoked_at = ?, replaced_by_token_id = ?
                WHERE token_id = ? IF revoked_at = null
                """);
        this.findSessions = session.prepare("""
                SELECT issued_at, token_id, device_id, expires_at, revoked_at, replaced_by_token_id
                FROM refresh_tokens_by_user WHERE user_id = ? LIMIT ?
                """);
        this.revokeSession = session.prepare("""
                UPDATE refresh_tokens_by_user SET revoked_at = ?
                WHERE user_id = ? AND issued_at = ? AND token_id = ? IF revoked_at = null
                """);
    }

    @Override public void save(UUID userId, UUID issuedAt, UUID tokenId, String hash, Instant expiresAt) {
        session.execute(saveSession.bind(userId, issuedAt, tokenId, hash, null, expiresAt));
        session.execute(saveOwner.bind(tokenId, userId, hash, expiresAt));
    }

    @Override public TokenOwner findOwner(UUID tokenId) {
        var row = session.execute(findOwner.bind(tokenId)).one();
        return row == null ? null : new TokenOwner(
                row.getUuid("token_id"), row.getUuid("user_id"), row.getString("token_hash"),
                row.getInstant("expires_at"), row.getInstant("revoked_at"));
    }

    @Override public boolean revoke(UUID tokenId, UUID replacementTokenId, Instant revokedAt) {
        return session.execute(revokeOwner.bind(revokedAt, replacementTokenId, tokenId)).wasApplied();
    }

    @Override public List<Session> findSessions(UUID userId, int limit) {
        return session.execute(findSessions.bind(userId, Math.max(1, Math.min(200, limit))))
                .all().stream().map(row -> new Session(
                        row.getUuid("token_id"), row.getUuid("issued_at"), row.getUuid("device_id"),
                        row.getInstant("expires_at"), row.getInstant("revoked_at"),
                        row.getUuid("replaced_by_token_id"))).toList();
    }

    @Override public boolean revokeForUser(UUID userId, UUID tokenId, Instant revokedAt) {
        TokenOwner owner = findOwner(tokenId);
        if (owner == null || !userId.equals(owner.userId()) || owner.revokedAt() != null) return false;
        Session target = findSessions(userId, 200).stream()
                .filter(item -> tokenId.equals(item.tokenId())).findFirst().orElse(null);
        if (target == null || target.revokedAt() != null) return false;
        if (!session.execute(revokeSession.bind(revokedAt, userId, target.issuedAt(), tokenId)).wasApplied()) {
            return false;
        }
        session.execute(revokeOwner.bind(revokedAt, null, tokenId));
        return true;
    }
}
