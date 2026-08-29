package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CanonicalBackendServiceUserTest {

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
    void userSearchReturnsBoundedPublicResultsAndCursor() {
        UUID actorId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        when(store.searchUsersByPrefix("al", null, null, 2)).thenReturn(List.of(
                new CanonicalCqlStore.UserDirectoryRow("alice", firstId, "Alice", "Alice", null, "ACTIVE"),
                new CanonicalCqlStore.UserDirectoryRow("alina", secondId, "Alina", "Alina", null, "ACTIVE")));

        var page = service().searchUsers(actorId, " Al ", 1, null);

        assertThat(page.content()).singleElement()
                .extracting(user -> user.userId())
                .isEqualTo(firstId);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
    }

    @Test
    void userSearchRejectsQueriesThatCannotUseThePrefixProjection() {
        assertThatThrownBy(() -> service().searchUsers(UUID.randomUUID(), "a", 20, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at least 2");
    }

    @Test
    void chatAppearancePreferencesAreCreatedWithCanonicalDefaults() {
        UUID userId = UUID.randomUUID();

        CanonicalChatPreferences preferences = service().getChatAppearancePreferences(userId);

        assertThat(preferences.userId()).isEqualTo(userId);
        assertThat(preferences.defaultThemeId()).isEqualTo("aurora");
        assertThat(preferences.defaultBubbleStyleId()).isEqualTo("tiktok");
        verify(store).saveChatPreferences(preferences);
    }

    @Test
    void chatAppearancePreferencesRejectUnknownRegistryIds() {
        assertThatThrownBy(() -> service().updateChatAppearancePreferences(
                UUID.randomUUID(),
                new CanonicalApiContracts.ChatAppearancePreferencesRequest("unknown", "tiktok")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("themeId");
    }

    @Test
    void roomAppearancePreferencesRequireMembership() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversationMember(conversationId, userId)).thenReturn(null);

        assertThatThrownBy(() -> service().updateConversationAppearancePreferences(
                userId,
                conversationId,
                new CanonicalApiContracts.ConversationAppearancePreferencesRequest("aurora", null)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not member");
    }

    @Test
    void roomAppearancePreferencesRejectUnsafeBackgroundUrls() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversationMember(conversationId, userId)).thenReturn(
                new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember(
                        conversationId, userId, java.util.Set.of(), java.time.Instant.now(), null,
                        null, null, null, null, null));

        assertThatThrownBy(() -> service().updateConversationAppearancePreferences(
                userId,
                conversationId,
                new CanonicalApiContracts.ConversationAppearancePreferencesRequest(
                        "aurora", "javascript:alert(1)")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("http(s)");
    }

    @Test
    void registerDeviceNormalizesCanonicalMetadata() {
        UUID userId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        var expected = new CanonicalCqlStore.DeviceSessionRow(
                deviceId, "WEB", "WEB_PUSH", "Laptop", null, true,
                java.time.Instant.now(), java.time.Instant.now());
        when(store.saveDevice(
                org.mockito.ArgumentMatchers.eq(userId),
                org.mockito.ArgumentMatchers.eq(deviceId),
                org.mockito.ArgumentMatchers.eq("WEB"),
                org.mockito.ArgumentMatchers.eq("WEB_PUSH"),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq("Laptop"),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.any(java.time.Instant.class))).thenReturn(expected);

        var actual = service().registerDevice(userId,
                new CanonicalApiContracts.DeviceRegistrationRequest(
                        deviceId, " web ", " web_push ", " ", " Laptop ", " "));

        assertThat(actual).isEqualTo(expected);
        verify(store).saveDevice(
                org.mockito.ArgumentMatchers.eq(userId),
                org.mockito.ArgumentMatchers.eq(deviceId),
                org.mockito.ArgumentMatchers.eq("WEB"),
                org.mockito.ArgumentMatchers.eq("WEB_PUSH"),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq("Laptop"),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.any(java.time.Instant.class));
    }

    @Test
    void registerDeviceRejectsUnknownPlatform() {
        assertThatThrownBy(() -> service().registerDevice(UUID.randomUUID(),
                new CanonicalApiContracts.DeviceRegistrationRequest(
                        UUID.randomUUID(), "DESKTOP", "WEB_PUSH", null, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("platform");
    }

    @Test
    void heartbeatRequiresAnActiveDevice() {
        UUID userId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        when(store.touchDevice(
                org.mockito.ArgumentMatchers.eq(userId),
                org.mockito.ArgumentMatchers.eq(deviceId),
                org.mockito.ArgumentMatchers.any(java.time.Instant.class)))
                .thenReturn(false);

        assertThatThrownBy(() -> service().touchDevice(userId, deviceId))
                .isInstanceOf(com.chatapp.chat_service.common.exception.NotFoundException.class)
                .hasMessageContaining("active device");
    }

    private CanonicalBackendService service() {
        return new CanonicalBackendService(
                store, passwordEncoder, tokenProvider, conversationRepository, authorization, eventRecorder, chatPolicy,
                messaging, adminConversationDirectory);
    }
}
