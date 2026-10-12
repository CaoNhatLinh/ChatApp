package com.chatapp.chat_service.canonical.appearance;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AppearanceServiceTest {

    @Mock
    private CanonicalCqlStore store;
    @Mock
    private AppearanceRepository preferences;
    @Test
    void chatAppearancePreferencesAreCreatedWithCanonicalDefaults() {
        UUID userId = UUID.randomUUID();

        CanonicalChatPreferences preferences = service().getDefaults(userId);

        assertThat(preferences.userId()).isEqualTo(userId);
        assertThat(preferences.defaultThemeId()).isEqualTo("aurora");
        assertThat(preferences.defaultBubbleStyleId()).isEqualTo("tiktok");
        verify(this.preferences).saveUserPreferences(preferences);
    }

    @Test
    void chatAppearancePreferencesRejectUnknownRegistryIds() {
        assertThatThrownBy(() -> service().updateDefaults(
                UUID.randomUUID(),
                new ChatAppearanceRequest("unknown", "tiktok")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("themeId");
    }

    @Test
    void roomAppearancePreferencesRequireMembership() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversationMember(conversationId, userId)).thenReturn(null);

        assertThatThrownBy(() -> service().updateRoom(
                userId,
                conversationId,
                new RoomAppearanceRequest("aurora", null)))
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

        assertThatThrownBy(() -> service().updateRoom(
                userId,
                conversationId,
                new RoomAppearanceRequest(
                        "aurora", "javascript:alert(1)")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("http(s)");
    }

    private AppearanceService service() {
        return new AppearanceService(store, preferences);
    }
}
