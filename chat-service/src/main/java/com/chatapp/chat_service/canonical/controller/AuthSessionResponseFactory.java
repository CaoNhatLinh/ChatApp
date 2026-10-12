package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class AuthSessionResponseFactory {
    private final RefreshTokenService refreshTokens;
    private final long refreshLifetimeMs;
    private final boolean refreshCookieSecure;

    public AuthSessionResponseFactory(
            RefreshTokenService refreshTokens,
            @Value("${app.auth.refresh-lifetime-ms:2592000000}") long refreshLifetimeMs,
            @Value("${app.auth.cookie-secure:false}") boolean refreshCookieSecure) {
        this.refreshTokens = refreshTokens;
        this.refreshLifetimeMs = refreshLifetimeMs;
        this.refreshCookieSecure = refreshCookieSecure;
    }

    public <T> ResponseEntity<T> authenticated(T body, UUID userId, HttpStatus status) {
        String refreshToken = refreshTokens.issue(userId);
        return ResponseEntity.status(status)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken).toString())
                .header(HttpHeaders.SET_COOKIE, sessionHintCookie().toString())
                .body(body);
    }

    public <T> ResponseEntity<T> refreshed(T body, String refreshToken) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken).toString())
                .header(HttpHeaders.SET_COOKIE, sessionHintCookie().toString())
                .body(body);
    }

    public ResponseEntity<Void> loggedOut(String refreshToken) {
        refreshTokens.revoke(refreshToken);
        return ResponseEntity.noContent()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                .header(HttpHeaders.SET_COOKIE, clearSessionHintCookie().toString())
                .build();
    }

    private ResponseCookie refreshCookie(String token) {
        return ResponseCookie.from("novachat_refresh", token)
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(refreshLifetimeMs / 1000)
                .build();
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from("novachat_refresh", "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(0)
                .build();
    }

    private ResponseCookie sessionHintCookie() {
        return ResponseCookie.from("novachat_session", "1")
                .httpOnly(false)
                .secure(refreshCookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(refreshLifetimeMs / 1000)
                .build();
    }

    private ResponseCookie clearSessionHintCookie() {
        return ResponseCookie.from("novachat_session", "")
                .httpOnly(false)
                .secure(refreshCookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }
}
