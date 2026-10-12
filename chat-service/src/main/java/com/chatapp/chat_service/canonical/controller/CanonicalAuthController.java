package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.auth.AuthService;
import com.chatapp.chat_service.canonical.service.RefreshTokenService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class CanonicalAuthController {

    private final AuthService authentication;
    private final SecurityContextHelper securityContext;
    private final RefreshTokenService refreshTokens;
    private final AuthSessionResponseFactory sessions;

    public CanonicalAuthController(
            AuthService authentication,
            SecurityContextHelper securityContext,
            RefreshTokenService refreshTokens,
            AuthSessionResponseFactory sessions) {
        this.authentication = authentication;
        this.securityContext = securityContext;
        this.refreshTokens = refreshTokens;
        this.sessions = sessions;
    }

    @PostMapping("/register")
    public ResponseEntity<CanonicalApiContracts.UserResponse> register(
            @Valid @RequestBody CanonicalApiContracts.RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authentication.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<CanonicalApiContracts.AuthResponse> login(
            @Valid @RequestBody CanonicalApiContracts.LoginRequest request) {
        CanonicalApiContracts.AuthResponse response = authentication.login(request);
        return sessions.authenticated(response, response.user().userId(), HttpStatus.OK);
    }

    @PostMapping("/refresh")
    public ResponseEntity<CanonicalApiContracts.AuthResponse> refresh(
            @CookieValue(value = "novachat_refresh", required = false) String token) {
        RefreshTokenService.RefreshSession session = refreshTokens.refresh(token);
        return sessions.refreshed(session.response(), session.refreshToken());
    }

    @GetMapping("/me")
    public CanonicalApiContracts.UserResponse me() {
        return authentication.me(securityContext.getCurrentUserId());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(value = "novachat_refresh", required = false) String token) {
        return sessions.loggedOut(token);
    }
}
