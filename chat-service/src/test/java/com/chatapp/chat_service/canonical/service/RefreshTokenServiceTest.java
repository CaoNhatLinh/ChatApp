package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private CanonicalCqlStore store;
    @Mock
    private JwtTokenProvider tokenProvider;

    @Test
    void issueStoresOnlyHashAndReturnsOpaqueToken() {
        UUID userId = UUID.randomUUID();
        RefreshTokenService service = new RefreshTokenService(store, tokenProvider, 86_400_000L);

        String rawToken = service.issue(userId);

        assertThat(rawToken).startsWith(rawToken.substring(0, rawToken.indexOf('.')) + ".");
        assertThat(rawToken.substring(rawToken.indexOf('.') + 1)).hasSizeGreaterThan(20);
        ArgumentCaptor<String> tokenHash = ArgumentCaptor.forClass(String.class);
        verify(store).insertRefreshToken(any(), any(), any(), tokenHash.capture(), any());
        assertThat(tokenHash.getValue()).doesNotContain(rawToken);
    }

    @Test
    void rotateRejectsARevokedToken() {
        UUID tokenId = UUID.randomUUID();
        String rawToken = tokenId + ".secret-value";
        when(store.findRefreshTokenOwner(tokenId)).thenReturn(new CanonicalCqlStore.RefreshTokenOwnerRow(
                tokenId, UUID.randomUUID(), "wrong-hash", Instant.now().plusSeconds(60), Instant.now()));
        RefreshTokenService service = new RefreshTokenService(store, tokenProvider, 86_400_000L);

        assertThatThrownBy(() -> service.rotate(rawToken))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("invalid or expired");
    }

    @Test
    void rotateReturnsAReplacementAndIssuesANewAccessToken() {
        UUID userId = UUID.randomUUID();
        RefreshTokenService service = new RefreshTokenService(store, tokenProvider, 86_400_000L);
        String rawToken = service.issue(userId);
        UUID tokenId = UUID.fromString(rawToken.substring(0, rawToken.indexOf('.')));
        ArgumentCaptor<String> tokenHash = ArgumentCaptor.forClass(String.class);
        verify(store).insertRefreshToken(any(), any(), any(), tokenHash.capture(), any());
        when(store.findRefreshTokenOwner(tokenId)).thenReturn(new CanonicalCqlStore.RefreshTokenOwnerRow(
                tokenId, userId, tokenHash.getValue(), Instant.now().plusSeconds(60), null));
        when(store.revokeRefreshToken(any(), any(), any())).thenReturn(true);
        CanonicalUser user = new CanonicalUser(
                userId, "alice", "alice", "alice@example.com", "alice@example.com", "hash", "LOCAL", null,
                "Alice", null, "ACTIVE", Instant.now(), Instant.now(), null);
        when(store.findUserById(userId)).thenReturn(user);
        when(tokenProvider.generateToken("alice", userId)).thenReturn("access-token");

        RefreshTokenService.RefreshSession session = service.refresh(rawToken);

        assertThat(session.response().accessToken()).isEqualTo("access-token");
        assertThat(session.refreshToken()).isNotEqualTo(rawToken);
        assertThat(session.response().user().userId()).isEqualTo(userId);
    }

    @Test
    void rotateRejectsInactiveAccountBeforeConsumingRefreshToken() {
        UUID userId = UUID.randomUUID();
        RefreshTokenService service = new RefreshTokenService(store, tokenProvider, 86_400_000L);
        String rawToken = service.issue(userId);
        UUID tokenId = UUID.fromString(rawToken.substring(0, rawToken.indexOf('.')));
        ArgumentCaptor<String> tokenHash = ArgumentCaptor.forClass(String.class);
        verify(store).insertRefreshToken(any(), any(), any(), tokenHash.capture(), any());
        when(store.findRefreshTokenOwner(tokenId)).thenReturn(new CanonicalCqlStore.RefreshTokenOwnerRow(
                tokenId, userId, tokenHash.getValue(), Instant.now().plusSeconds(60), null));
        when(store.findUserById(userId)).thenReturn(new CanonicalUser(
                userId, "blocked", "blocked", "blocked@example.com", "blocked@example.com", "hash", "LOCAL", null,
                "Blocked", null, "SUSPENDED", Instant.now(), Instant.now(), null));

        assertThatThrownBy(() -> service.rotate(rawToken))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("user account is unavailable");
        verify(store, never()).revokeRefreshToken(any(), any(), any());
    }

    @Test
    void rotateCompensatesReplacementWhenOldTokenCasLoses() {
        UUID userId = UUID.randomUUID();
        RefreshTokenService service = new RefreshTokenService(store, tokenProvider, 86_400_000L);
        String rawToken = service.issue(userId);
        UUID tokenId = UUID.fromString(rawToken.substring(0, rawToken.indexOf('.')));
        ArgumentCaptor<String> tokenHash = ArgumentCaptor.forClass(String.class);
        verify(store).insertRefreshToken(any(), any(), any(), tokenHash.capture(), any());
        when(store.findRefreshTokenOwner(tokenId)).thenReturn(new CanonicalCqlStore.RefreshTokenOwnerRow(
                tokenId, userId, tokenHash.getValue(), Instant.now().plusSeconds(60), null));
        when(store.findUserById(userId)).thenReturn(new CanonicalUser(
                userId, "alice", "alice", "alice@example.com", "alice@example.com", "hash", "LOCAL", null,
                "Alice", null, "ACTIVE", Instant.now(), Instant.now(), null));
        when(store.revokeRefreshToken(any(), any(), any())).thenReturn(false, true);

        assertThatThrownBy(() -> service.rotate(rawToken))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("refresh token was already used");
        ArgumentCaptor<UUID> revokedTokenId = ArgumentCaptor.forClass(UUID.class);
        verify(store, org.mockito.Mockito.times(2))
                .revokeRefreshToken(revokedTokenId.capture(), any(), any());
        assertThat(revokedTokenId.getAllValues()).contains(tokenId);
        assertThat(revokedTokenId.getAllValues().get(1)).isNotEqualTo(tokenId);
    }
}
