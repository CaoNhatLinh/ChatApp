package com.chatapp.chat_service.canonical.auth;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.notification.NotificationRepository;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository store;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private NotificationRepository notifications;

    @Test
    void registrationReturnsSafeCanonicalUserAndPersistsPasswordHash() {
        when(store.claimUsername(any(), any(), any())).thenReturn(true);
        when(store.claimEmail(any(), any(), any())).thenReturn(true);
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        AuthService service = service();

        CanonicalApiContracts.UserResponse response = service.register(
                new CanonicalApiContracts.RegisterRequest(
                        "Alice", "alice@example.com", "password123", "Alice"));

        assertThat(response.username()).isEqualTo("Alice");
        assertThat(response.email()).isEqualTo("alice@example.com");
        ArgumentCaptor<CanonicalUser> savedUser = ArgumentCaptor.forClass(CanonicalUser.class);
        verify(store).save(savedUser.capture());
        assertThat(savedUser.getValue().passwordHash()).isEqualTo("encoded-password");
        assertThat(savedUser.getValue().authProvider()).isEqualTo("LOCAL");
        ArgumentCaptor<CanonicalNotificationSettings> savedSettings =
                ArgumentCaptor.forClass(CanonicalNotificationSettings.class);
        verify(notifications).saveSettings(savedSettings.capture());
        assertThat(savedSettings.getValue().globalLevel()).isEqualTo("ALL");
    }

    @Test
    void localLoginRejectsExternalOnlyAccountWithoutCallingPasswordEncoder() {
        CanonicalUser user = new CanonicalUser(
                UUID.randomUUID(), "alice", "alice", "alice@example.com", "alice@example.com",
                null, "FIREBASE_GOOGLE", "firebase-uid", "Alice", null, "ACTIVE",
                Instant.now(), Instant.now(), null);
        when(store.findByUsername("alice")).thenReturn(user);

        assertThatThrownBy(() -> service().login(
                new CanonicalApiContracts.LoginRequest("alice", "password123")))
                .hasMessage("invalid credentials");
    }

    @Test
    void registrationReleasesUsernameWhenEmailIsUnavailable() {
        when(store.claimUsername(any(), any(), any())).thenReturn(true);
        when(store.claimEmail(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service().register(new CanonicalApiContracts.RegisterRequest(
                "Alice", "alice@example.com", "password123", "Alice")))
                .hasMessage("email already exists");

        verify(store).releaseUsername(any(), any());
        verify(store, never()).save(any());
    }

    @Test
    void loginReturnsAccessTokenAndSafeUserProjection() {
        UUID userId = UUID.randomUUID();
        CanonicalUser user = new CanonicalUser(
                userId, "alice", "alice", "alice@example.com", "alice@example.com",
                "encoded-password", "LOCAL", null, "Alice", null, "ACTIVE",
                Instant.now(), Instant.now(), null);
        when(store.findByUsername("alice")).thenReturn(user);
        when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
        when(tokenProvider.generateToken("alice", userId)).thenReturn("signed-token");

        CanonicalApiContracts.AuthResponse response = service().login(
                new CanonicalApiContracts.LoginRequest("alice", "password123"));

        assertThat(response.accessToken()).isEqualTo("signed-token");
        assertThat(response.user().userId()).isEqualTo(userId);
        assertThat(response.user().username()).isEqualTo("alice");
    }

    private AuthService service() {
        return new AuthService(store, passwordEncoder, tokenProvider, notifications);
    }
}
