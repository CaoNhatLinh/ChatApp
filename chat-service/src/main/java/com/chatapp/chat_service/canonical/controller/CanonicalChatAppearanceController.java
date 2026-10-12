package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.appearance.AppearanceService;
import com.chatapp.chat_service.canonical.appearance.ChatAppearanceRequest;
import com.chatapp.chat_service.canonical.appearance.RoomAppearanceRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/preferences/chat")
public class CanonicalChatAppearanceController {

    private final AppearanceService appearance;
    private final SecurityContextHelper securityContext;

    public CanonicalChatAppearanceController(
            AppearanceService appearance,
            SecurityContextHelper securityContext) {
        this.appearance = appearance;
        this.securityContext = securityContext;
    }

    @GetMapping
    public ChatAppearancePreferencesView get() {
        CanonicalChatPreferences defaults = appearance.getDefaults(actorId());
        List<CanonicalConversationPreferences> rooms = appearance.listRoomPreferences(actorId());
        return new ChatAppearancePreferencesView(
                defaults.defaultThemeId(),
                defaults.defaultBubbleStyleId(),
                rooms.stream().map(this::toRoomView).toList());
    }

    @PutMapping
    public ResponseEntity<Void> update(
            @RequestBody @Valid ChatAppearanceRequest request) {
        appearance.updateDefaults(actorId(), request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/rooms/{conversationId}")
    public ResponseEntity<Void> updateRoom(
            @PathVariable UUID conversationId,
            @RequestBody @Valid RoomAppearanceRequest request) {
        appearance.updateRoom(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rooms/{conversationId}")
    public ResponseEntity<Void> resetRoom(@PathVariable UUID conversationId) {
        appearance.resetRoom(actorId(), conversationId);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }

    private ConversationAppearanceView toRoomView(CanonicalConversationPreferences preferences) {
        return new ConversationAppearanceView(
                preferences.conversationId(),
                preferences.themeId(),
                preferences.customBackgroundUrl(),
                preferences.updatedAt());
    }

    public record ChatAppearancePreferencesView(
            String defaultThemeId,
            String defaultBubbleStyleId,
            List<ConversationAppearanceView> rooms) {
    }

    public record ConversationAppearanceView(
            UUID conversationId,
            String themeId,
            String customBackgroundUrl,
            Instant updatedAt) {
    }
}
