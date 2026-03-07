package com.chatapp.chat_service.security.jwt;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * ✅ Unified JWT Token Provider - Replaces both JwtService & JwtUtil
 * - Generate tokens with userId claim
 * - Validate and extract claims
 * - Exception handling
 * - Configuration from properties
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private final Key signingKey;
    private final long expirationMs;
    private static final String USER_ID_CLAIM = "userId";

    public JwtTokenProvider(
            @Value("${jwt.secret:Fzq8zZPO1YcV0aRCFMCYdxnDAhJ4TLWit5RGkZllNFA=}") String secretKey,
            @Value("${jwt.expiration-ms:604800000}") long expirationMs) {

        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
        this.expirationMs = expirationMs;
        log.info("✅ JwtTokenProvider initialized with {} ms expiration", expirationMs);
    }

    /**
     * Generate JWT token with username + userId
     * ✅ Clean: Single method, clear purpose
     */
    public String generateToken(String username, UUID userId) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusMillis(expirationMs);

        return Jwts.builder()
                .setSubject(username)
                .claim(USER_ID_CLAIM, userId.toString())
                .setIssuedAt(new Date(now.toEpochMilli()))
                .setExpiration(new Date(expiresAt.toEpochMilli()))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Validate token signature & expiration
     * ✅ Returns boolean (not throwing exception)
     */
    public boolean isTokenValid(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(signingKey)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("⚠️ JWT token expired");
            return false;
        } catch (UnsupportedJwtException ex) {
            log.warn("⚠️ JWT token format not supported");
            return false;
        } catch (MalformedJwtException ex) {
            log.warn("⚠️ Invalid JWT token");
            return false;
        } catch (SignatureException ex) {
            log.warn("⚠️ JWT signature validation failed");
            return false;
        } catch (IllegalArgumentException ex) {
            log.warn("⚠️ JWT claims string is empty");
            return false;
        }
    }

    /**
     * Extract all claims from token
     * ✅ Single source of truth for parsing
     */
    public Claims extractClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * Extract username from token
     */
    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * Extract userId from token
     */
    public UUID extractUserId(String token) {
        String userIdStr = extractClaims(token).get(USER_ID_CLAIM, String.class);
        return UUID.fromString(userIdStr);
    }

    /**
     * Check if token is expired
     */
    public boolean isTokenExpired(String token) {
        try {
            Date expiration = extractClaims(token).getExpiration();
            return expiration.before(new Date());
        } catch (JwtException e) {
            return true;
        }
    }
}