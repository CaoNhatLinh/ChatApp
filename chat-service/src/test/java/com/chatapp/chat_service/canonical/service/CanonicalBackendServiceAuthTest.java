package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanonicalBackendServiceAuthTest {

    @Mock
    private CanonicalCqlStore store;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private CanonicalConversationRepository conversationRepository;
    @Mock
    private ConversationAuthorizationService authorization;
    @Mock
    private CanonicalEventRecorder eventRecorder;
    @Mock
    private ChatPolicyService chatPolicy;
    @Mock
    private SimpMessagingTemplate messaging;
    @Mock
    private AdminConversationDirectoryRepository adminConversationDirectory;

    @Test
    void registrationReturnsSafeCanonicalUserAndPersistsPasswordHash() {
        when(store.claimUsername(any(), any(), any())).thenReturn(true);
        when(store.claimEmail(any(), any(), any())).thenReturn(true);
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        CanonicalBackendService service = new CanonicalBackendService(
                store, passwordEncoder, tokenProvider, conversationRepository, authorization, eventRecorder, chatPolicy,
                messaging, adminConversationDirectory);

        CanonicalApiContracts.UserResponse response = service.register(
                new CanonicalApiContracts.RegisterRequest(
                        "Alice", "alice@example.com", "password123", "Alice", "LOCAL"));

        assertThat(response.username()).isEqualTo("Alice");
        assertThat(response.email()).isEqualTo("alice@example.com");
        ArgumentCaptor<CanonicalUser> savedUser = ArgumentCaptor.forClass(CanonicalUser.class);
        verify(store).saveUser(savedUser.capture());
        assertThat(savedUser.getValue().passwordHash()).isEqualTo("encoded-password");
        ArgumentCaptor<CanonicalNotificationSettings> savedSettings = ArgumentCaptor.forClass(CanonicalNotificationSettings.class);
        verify(store).saveNotificationSetting(savedSettings.capture());
        assertThat(savedSettings.getValue().globalLevel()).isEqualTo("ALL");
    }

    @Test
    void loginReturnsAccessTokenAndSafeUserProjection() {
        UUID userId = UUID.randomUUID();
        CanonicalUser user = new CanonicalUser(
                userId, "alice", "alice", "alice@example.com", "alice@example.com",
                "encoded-password", "LOCAL", null, "Alice", null, "ACTIVE",
                Instant.now(), Instant.now(), null);
        when(store.findUserByUsername("alice")).thenReturn(user);
        when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
        when(tokenProvider.generateToken("alice", userId)).thenReturn("signed-token");
        CanonicalBackendService service = new CanonicalBackendService(
                store, passwordEncoder, tokenProvider, conversationRepository, authorization, eventRecorder, chatPolicy,
                messaging, adminConversationDirectory);

        CanonicalApiContracts.AuthResponse response = service.login(
                new CanonicalApiContracts.LoginRequest("alice", "password123"));

        assertThat(response.accessToken()).isEqualTo("signed-token");
        assertThat(response.user().userId()).isEqualTo(userId);
        assertThat(response.user().username()).isEqualTo("alice");
    }
}
