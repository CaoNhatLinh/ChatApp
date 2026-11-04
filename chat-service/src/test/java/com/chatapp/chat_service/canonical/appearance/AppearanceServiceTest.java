package com.chatapp.chat_service.canonical.appearance;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.canonical.media.MediaAsset;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class AppearanceServiceTest {

    private static final String BACKGROUND_URL = "https://res.cloudinary.com/demo/image/upload/background.png";

    @Mock
    private CanonicalCqlStore store;
    @Mock
    private AppearanceRepository preferences;
    @Mock
    private MediaAssetRepository assets;

    @Test
    void chatAppearancePreferencesAreCreatedWithCanonicalDefaults() {
        UUID userId = UUID.randomUUID();

        CanonicalChatPreferences preferences = service().getDefaults(userId);

        assertThat(preferences.userId()).isEqualTo(userId);
        assertThat(preferences.defaultThemeId()).isEqualTo("system");
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
        return new AppearanceService(store, preferences,
                new com.chatapp.chat_service.canonical.media.ManagedImageReference(assets, "noi-test"));
    }

    @Test
    void retainsOwnedReadyImageBeforeSavingItsCanonicalBackground() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        member(userId, conversationId);
        when(assets.findById(assetId)).thenReturn(background(assetId, userId));
        when(assets.retainForHistory(assetId)).thenReturn(true);

        service().updateRoom(userId, conversationId, new RoomAppearanceRequest("aurora", BACKGROUND_URL, assetId));

        var writes = inOrder(assets, preferences);
        writes.verify(assets).retainForHistory(assetId);
        writes.verify(preferences).saveConversationPreferences(argThat(saved ->
                assetId.toString().equals(saved.backgroundAssetId()) && BACKGROUND_URL.equals(saved.customBackgroundUrl())));
    }

    @Test
    void rejectsForeignImageBeforeRetainingOrSavingIt() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        member(userId, conversationId);
        when(assets.findById(assetId)).thenReturn(background(assetId, UUID.randomUUID()));

        assertThatThrownBy(() -> service().updateRoom(userId, conversationId,
                new RoomAppearanceRequest("aurora", null, assetId))).isInstanceOf(ForbiddenException.class);

        verify(assets, never()).retainForHistory(any());
        verify(preferences, never()).saveConversationPreferences(any());
    }

    @Test
    void rejectsMismatchingBackgroundUrlBeforeRetainingOrSavingIt() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        member(userId, conversationId);
        when(assets.findById(assetId)).thenReturn(background(assetId, userId));

        assertThatThrownBy(() -> service().updateRoom(userId, conversationId,
                new RoomAppearanceRequest("aurora", "https://example.test/other.png", assetId)))
                .isInstanceOf(BadRequestException.class);

        verify(assets, never()).retainForHistory(any());
        verify(preferences, never()).saveConversationPreferences(any());
    }

    @Test
    void aCompetingDeletionPreventsSavingABrokenBackground() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        member(userId, conversationId);
        when(assets.findById(assetId)).thenReturn(background(assetId, userId));
        when(assets.retainForHistory(assetId)).thenReturn(false);

        assertThatThrownBy(() -> service().updateRoom(userId, conversationId,
                new RoomAppearanceRequest("aurora", null, assetId))).isInstanceOf(ConflictException.class);

        verify(preferences, never()).saveConversationPreferences(any());
    }

    @Test
    void aLegacyThemeChangeKeepsAnExistingAssetReferenceWhenTheUrlIsUnchanged() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        String assetId = UUID.randomUUID().toString();
        member(userId, conversationId);
        when(preferences.findConversationPreferences(userId, conversationId)).thenReturn(
                new CanonicalConversationPreferences(userId, conversationId, "studio", null, assetId, BACKGROUND_URL, Instant.EPOCH));

        service().updateRoom(userId, conversationId, new RoomAppearanceRequest("aurora", BACKGROUND_URL));

        verify(preferences).saveConversationPreferences(argThat(saved -> "aurora".equals(saved.themeId())
                && assetId.equals(saved.backgroundAssetId()) && BACKGROUND_URL.equals(saved.customBackgroundUrl())));
        verifyNoInteractions(assets);
    }

    private void member(UUID userId, UUID conversationId) {
        when(store.findConversationMember(conversationId, userId)).thenReturn(new CanonicalConversationMember(
                conversationId, userId, Set.of(), Instant.EPOCH, null, null, null, null, null, null));
    }

    private static MediaAsset background(UUID assetId, UUID userId) {
        return new MediaAsset(assetId, userId, "CLOUDINARY", "background", BACKGROUND_URL, "background.png",
                "image/png", 100, 32, 32, null, null, "READY", "PENDING", "PENDING", Instant.EPOCH, null);
    }

    @Test
    void explicitlySelectedThemeIsNotOverwrittenByNewFollowAppDefault() {
        UUID userId = UUID.randomUUID();
        var existing = new CanonicalChatPreferences(userId, "vapor", "glass", null, java.time.Instant.now());
        when(preferences.findUserPreferences(userId)).thenReturn(existing);
        assertThat(service().getDefaults(userId)).isSameAs(existing);
        org.mockito.Mockito.verify(preferences, org.mockito.Mockito.never()).saveUserPreferences(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void acceptsFollowAppAsPersistedPreference() {
        UUID userId = UUID.randomUUID();
        var existing = new CanonicalChatPreferences(userId, "vapor", "glass", null, java.time.Instant.now());
        when(preferences.findUserPreferences(userId)).thenReturn(existing);
        service().updateDefaults(userId, new ChatAppearanceRequest("system", "glass"));
        verify(preferences).saveUserPreferences(org.mockito.ArgumentMatchers.argThat(value -> "system".equals(value.defaultThemeId())));
    }
}
