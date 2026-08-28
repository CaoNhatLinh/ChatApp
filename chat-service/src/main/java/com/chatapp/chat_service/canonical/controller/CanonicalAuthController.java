package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.canonical.service.RefreshTokenService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class CanonicalAuthController {

    private final CanonicalBackendService service;
    private final SecurityContextHelper securityContext;
    private final RefreshTokenService refreshTokens;
    private final long refreshLifetimeMs;
    private final boolean refreshCookieSecure;

    public CanonicalAuthController(
            CanonicalBackendService service,
            SecurityContextHelper securityContext,
            RefreshTokenService refreshTokens,
            @Value("${app.auth.refresh-lifetime-ms:2592000000}") long refreshLifetimeMs,
            @Value("${app.auth.cookie-secure:false}") boolean refreshCookieSecure) {
        this.service = service;
        this.securityContext = securityContext;
        this.refreshTokens = refreshTokens;
        this.refreshLifetimeMs = refreshLifetimeMs;
        this.refreshCookieSecure = refreshCookieSecure;
    }

    @PostMapping("/register")
    public ResponseEntity<CanonicalApiContracts.UserResponse> register(
            @Valid @RequestBody CanonicalApiContracts.RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<CanonicalApiContracts.AuthResponse> login(
            @Valid @RequestBody CanonicalApiContracts.LoginRequest request) {
        CanonicalApiContracts.AuthResponse response = service.login(request);
        return withRefreshCookie(response, refreshTokens.issue(response.user().userId()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<CanonicalApiContracts.AuthResponse> refresh(
            @CookieValue(value = "novachat_refresh", required = false) String token) {
        RefreshTokenService.RefreshSession session = refreshTokens.refresh(token);
        return withRefreshCookie(session.response(), session.refreshToken());
    }

    @GetMapping("/me")
    public CanonicalApiContracts.UserResponse me() {
        return service.me(securityContext.getCurrentUserId());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(value = "novachat_refresh", required = false) String token) {
        refreshTokens.revoke(token);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                .header(HttpHeaders.SET_COOKIE, clearSessionHintCookie().toString())
                .build();
    }

    private ResponseEntity<CanonicalApiContracts.AuthResponse> withRefreshCookie(
            CanonicalApiContracts.AuthResponse response, String token) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(token).toString())
                .header(HttpHeaders.SET_COOKIE, sessionHintCookie().toString())
                .body(response);
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
