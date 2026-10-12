package com.chatapp.chat_service.canonical.auth;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface RefreshTokenRepository {
    void save(UUID userId, UUID issuedAt, UUID tokenId, String tokenHash, Instant expiresAt);
    TokenOwner findOwner(UUID tokenId);
    boolean revoke(UUID tokenId, UUID replacementTokenId, Instant revokedAt);
    List<Session> findSessions(UUID userId, int limit);
    boolean revokeForUser(UUID userId, UUID tokenId, Instant revokedAt);

    record TokenOwner(UUID tokenId, UUID userId, String tokenHash, Instant expiresAt, Instant revokedAt) {}
    record Session(
            UUID tokenId, UUID issuedAt, UUID deviceId, Instant expiresAt,
            Instant revokedAt, UUID replacedByTokenId) {}
}
