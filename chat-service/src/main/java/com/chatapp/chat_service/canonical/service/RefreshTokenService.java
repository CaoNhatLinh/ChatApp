package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class RefreshTokenService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CanonicalCqlStore store;
    private final JwtTokenProvider tokenProvider;
    private final long refreshLifetimeMs;

    public RefreshTokenService(
            CanonicalCqlStore store,
            JwtTokenProvider tokenProvider,
            @Value("${app.auth.refresh-lifetime-ms:2592000000}") long refreshLifetimeMs) {
        this.store = store;
        this.tokenProvider = tokenProvider;
        this.refreshLifetimeMs = refreshLifetimeMs;
    }

    public String issue(UUID userId) {
        UUID tokenId = UUID.randomUUID();
        String secret = randomSecret();
        Instant expiresAt = Instant.now().plusMillis(refreshLifetimeMs);
        store.insertRefreshToken(userId, com.datastax.oss.driver.api.core.uuid.Uuids.timeBased(), tokenId,
                hash(tokenId + "." + secret), expiresAt);
        return tokenId + "." + secret;
    }

    public RotatedToken rotate(String rawToken) {
        TokenParts parts = parse(rawToken);
        CanonicalCqlStore.RefreshTokenOwnerRow owner = store.findRefreshTokenOwner(parts.tokenId());
        Instant now = Instant.now();
        if (owner == null || owner.revokedAt() != null || owner.expiresAt() == null
                || !owner.expiresAt().isAfter(now)
                || !MessageDigest.isEqual(owner.tokenHash().getBytes(StandardCharsets.UTF_8),
                hash(rawToken).getBytes(StandardCharsets.UTF_8))) {
            throw new ForbiddenException("refresh token is invalid or expired");
        }
        CanonicalUser currentUser = store.findUserById(owner.userId());
        if (currentUser == null || !"ACTIVE".equalsIgnoreCase(currentUser.accountStatus())) {
            // Do not rotate/revoke a valid refresh token for a suspended or
            // banned account. This keeps account recovery and operator revoke
            // semantics deterministic instead of consuming the only session.
            throw new ForbiddenException("user account is unavailable");
        }
        String replacement = issue(owner.userId());
        UUID replacementId = UUID.fromString(replacement.substring(0, replacement.indexOf('.')));
        if (!store.revokeRefreshToken(parts.tokenId(), replacementId, now)) {
            // The replacement is inserted before the old-token CAS so it can
            // carry the replacement pointer. If the old token was consumed by
            // another request, revoke the newly inserted token as compensation
            // instead of leaving an orphaned active session.
            store.revokeRefreshToken(replacementId, null, now);
            throw new ForbiddenException("refresh token was already used");
        }
        return new RotatedToken(replacement, owner.userId());
    }

    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        try {
            TokenParts parts = parse(rawToken);
            CanonicalCqlStore.RefreshTokenOwnerRow owner = store.findRefreshTokenOwner(parts.tokenId());
            if (owner != null && MessageDigest.isEqual(owner.tokenHash().getBytes(StandardCharsets.UTF_8),
                    hash(rawToken).getBytes(StandardCharsets.UTF_8))) {
                store.revokeRefreshToken(parts.tokenId(), null, Instant.now());
            }
        } catch (RuntimeException ignored) {
            // Logout is idempotent; malformed client cookies are treated as already revoked.
        }
    }

    public RefreshSession refresh(String rawToken) {
        RotatedToken replacement = rotate(rawToken);
        CanonicalUser user = store.findUserById(replacement.userId());
        if (user == null) {
            throw new ForbiddenException("user account is unavailable");
        }
        var response = new com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AuthResponse(
                tokenProvider.generateToken(user.username(), user.userId()),
                toUserResponse(user));
        return new RefreshSession(response, replacement.rawToken());
    }

    private String randomSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private TokenParts parse(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ForbiddenException("refresh token is required");
        }
        int separator = rawToken.indexOf('.');
        if (separator <= 0 || separator == rawToken.length() - 1) {
            throw new ForbiddenException("refresh token is malformed");
        }
        try {
            return new TokenParts(UUID.fromString(rawToken.substring(0, separator)));
        } catch (IllegalArgumentException exception) {
            throw new ForbiddenException("refresh token is malformed");
        }
    }

    private record TokenParts(UUID tokenId) {
    }

    public record RotatedToken(String rawToken, UUID userId) {
    }

    public record RefreshSession(
            com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AuthResponse response,
            String refreshToken) {
    }

    private com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.UserResponse toUserResponse(
            com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser user) {
        return new com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.UserResponse(
                user.userId(), user.username(), user.email(), user.displayName(), user.avatarUrl(),
                user.accountStatus(), user.createdAt(), user.lastLoginAt());
    }
}
