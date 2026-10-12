package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.auth.GoogleAuthContracts;
import com.chatapp.chat_service.canonical.auth.GoogleAuthService;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.RefreshTokenService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GoogleAuthControllerTest {
    @Mock private GoogleAuthService googleAuth;
    @Mock private RefreshTokenService refreshTokens;
    @Mock private SecurityContextHelper securityContext;

    @Test
    void exchangeSetsCanonicalSessionCookieOnlyAfterSignIn() {
        UUID userId = UUID.randomUUID();
        GoogleAuthContracts.GoogleExchangeResponse response = signedIn(userId);
        when(googleAuth.exchange("firebase-token")).thenReturn(response);
        when(refreshTokens.issue(userId)).thenReturn("refresh-token");
        GoogleAuthController controller = controller();

        var result = controller.exchange(new GoogleAuthContracts.GoogleTokenRequest("firebase-token"));

        assertThat(result.getHeaders().get(HttpHeaders.SET_COOKIE))
                .anySatisfy(cookie -> assertThat(cookie).contains("novachat_refresh=refresh-token"));
        assertThat(result.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void exchangeDoesNotCreateSessionDuringRegistrationPrompt() {
        when(googleAuth.exchange("firebase-token")).thenReturn(
                GoogleAuthContracts.GoogleExchangeResponse.registrationRequired("Alice"));

        var result = controller().exchange(new GoogleAuthContracts.GoogleTokenRequest("firebase-token"));

        assertThat(result.getHeaders().get(HttpHeaders.SET_COOKIE)).isNull();
        assertThat(result.getBody().status()).isEqualTo("REGISTRATION_REQUIRED");
    }

    private GoogleAuthController controller() {
        AuthSessionResponseFactory sessions = new AuthSessionResponseFactory(refreshTokens, 60_000, false);
        return new GoogleAuthController(googleAuth, sessions, securityContext);
    }

    private GoogleAuthContracts.GoogleExchangeResponse signedIn(UUID userId) {
        var user = new CanonicalApiContracts.UserResponse(
                userId, "alice", "alice@example.com", "Alice", null, "ACTIVE", Instant.now(), Instant.now());
        return GoogleAuthContracts.GoogleExchangeResponse.signedIn(
                new CanonicalApiContracts.AuthResponse("access-token", user));
    }
}
