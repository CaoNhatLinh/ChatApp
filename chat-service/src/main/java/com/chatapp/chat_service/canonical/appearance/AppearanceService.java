package com.chatapp.chat_service.canonical.appearance;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.media.ManagedImageReference;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AppearanceService {
    private static final Set<String> THEMES = Set.of("system", "aurora", "neon", "studio", "vapor");
    private static final Set<String> BUBBLE_STYLES = Set.of("tiktok", "glass", "classic");

    private final CanonicalCqlStore store;
    private final AppearanceRepository preferences;
    private final ManagedImageReference images;

    public AppearanceService(CanonicalCqlStore store, AppearanceRepository preferences, ManagedImageReference images) {
        this.store = store;
        this.preferences = preferences;
        this.images = images;
    }

    public CanonicalChatPreferences getDefaults(UUID userId) {
        requireUser(userId);
        CanonicalChatPreferences current = preferences.findUserPreferences(userId);
        if (current == null) {
            current = new CanonicalChatPreferences(userId, "system", "tiktok", null, Instant.now());
            preferences.saveUserPreferences(current);
        }
        return current;
    }

    public List<CanonicalConversationPreferences> listRoomPreferences(UUID userId) {
        requireUser(userId);
        return preferences.findConversationPreferences(userId, 200);
    }

    public void updateDefaults(UUID userId, ChatAppearanceRequest request) {
        requireUser(userId);
        if (request == null) {
            throw new BadRequestException("chat appearance preferences are required");
        }
        CanonicalChatPreferences current = getDefaults(userId);
        preferences.saveUserPreferences(new CanonicalChatPreferences(
                userId,
                requireTheme(request.defaultThemeId()),
                requireBubbleStyle(request.defaultBubbleStyleId()),
                current.defaultBackgroundAssetId(),
                Instant.now()));
    }

    public void updateRoom(
            UUID userId,
            UUID conversationId,
            RoomAppearanceRequest request) {
        requireUser(userId);
        if (conversationId == null || request == null) {
            throw new BadRequestException("conversation appearance preferences are required");
        }
        requireMember(conversationId, userId);
        String theme = requireTheme(request.themeId());
        var background = resolveBackground(userId, conversationId, request);
        preferences.saveConversationPreferences(new CanonicalConversationPreferences(
                userId,
                conversationId,
                theme,
                null,
                background.assetId(),
                background.url(),
                Instant.now()));
    }

    private Background resolveBackground(UUID userId, UUID conversationId, RoomAppearanceRequest request) {
        String url = normalizeBackgroundUrl(request.customBackgroundUrl());
        UUID assetId = request.backgroundAssetId();
        if (assetId == null) {
            if (url == null) return new Background(null, null);
            images.retain(url);
            var current = preferences.findConversationPreferences(userId, conversationId);
            return new Background(current != null && url.equals(current.customBackgroundUrl())
                    ? current.backgroundAssetId() : null, url);
        }
        return new Background(assetId.toString(), images.retain(userId, assetId, url));
    }

    private record Background(String assetId, String url) {}

    public void resetRoom(UUID userId, UUID conversationId) {
        requireUser(userId);
        if (conversationId == null) {
            throw new BadRequestException("conversationId is required");
        }
        requireMember(conversationId, userId);
        preferences.deleteConversationPreferences(userId, conversationId);
    }

    private void requireUser(UUID userId) {
        if (userId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    private void requireMember(UUID conversationId, UUID userId) {
        if (store.findConversationMember(conversationId, userId) == null) {
            throw new ForbiddenException("not member of conversation");
        }
    }

    private String requireTheme(String themeId) {
        if (!THEMES.contains(themeId)) {
            throw new BadRequestException("themeId must be one of system, aurora, neon, studio, vapor");
        }
        return themeId;
    }

    private String requireBubbleStyle(String bubbleStyleId) {
        if (!BUBBLE_STYLES.contains(bubbleStyleId)) {
            throw new BadRequestException("defaultBubbleStyleId must be one of tiktok, glass, classic");
        }
        return bubbleStyleId;
    }

    private String normalizeBackgroundUrl(String backgroundUrl) {
        if (backgroundUrl == null || backgroundUrl.isBlank()) {
            return null;
        }
        String normalized = backgroundUrl.trim();
        try {
            URI uri = URI.create(normalized);
            String scheme = uri.getScheme();
            if (uri.getHost() == null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
                throw new IllegalArgumentException("unsupported background URL");
            }
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("customBackgroundUrl must be an absolute http(s) URL");
        }
        return normalized;
    }
}
