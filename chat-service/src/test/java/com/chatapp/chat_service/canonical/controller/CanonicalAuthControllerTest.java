package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.canonical.service.RefreshTokenService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanonicalAuthControllerTest {

    @Mock
    private CanonicalBackendService service;
    @Mock
    private SecurityContextHelper securityContext;
    @Mock
    private RefreshTokenService refreshTokens;

    @Test
    void loginSetsRefreshCredentialAndNonAuthorizingSessionHint() {
        UUID userId = UUID.randomUUID();
        CanonicalApiContracts.AuthResponse response = new CanonicalApiContracts.AuthResponse(
                "access-token",
                new CanonicalApiContracts.UserResponse(
                        userId, "alice", "alice@example.com", "Alice", null, "ACTIVE", Instant.now(), Instant.now()));
        when(service.login(new CanonicalApiContracts.LoginRequest("alice", "password123"))).thenReturn(response);
        when(refreshTokens.issue(userId)).thenReturn("refresh-token");
        CanonicalAuthController controller = new CanonicalAuthController(
                service, securityContext, refreshTokens, 60_000, false);

        ResponseEntity<CanonicalApiContracts.AuthResponse> result = controller.login(
                new CanonicalApiContracts.LoginRequest("alice", "password123"));

        List<String> cookies = result.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertThat(cookies).anySatisfy(cookie -> {
            assertThat(cookie).contains("novachat_refresh=refresh-token");
            assertThat(cookie).contains("HttpOnly");
        });
        assertThat(cookies).anySatisfy(cookie -> {
            assertThat(cookie).contains("novachat_session=1");
            assertThat(cookie).doesNotContain("HttpOnly");
        });
    }

    @Test
    void logoutRevokesRefreshTokenAndClearsBothCookies() {
        CanonicalAuthController controller = new CanonicalAuthController(
                service, securityContext, refreshTokens, 60_000, false);

        ResponseEntity<Void> result = controller.logout("refresh-token");

        verify(refreshTokens).revoke("refresh-token");
        List<String> cookies = result.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertThat(cookies).anySatisfy(cookie -> assertThat(cookie)
                .contains("novachat_refresh=")
                .contains("Max-Age=0"));
        assertThat(cookies).anySatisfy(cookie -> assertThat(cookie)
                .contains("novachat_session=")
                .contains("Max-Age=0"));
    }
}
