package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
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

    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalChatAppearanceController(
            CanonicalBackendService backend,
            SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @GetMapping
    public ChatAppearancePreferencesView get() {
        CanonicalChatPreferences defaults = backend.getChatAppearancePreferences(actorId());
        List<CanonicalConversationPreferences> rooms = backend.listConversationAppearancePreferences(actorId());
        return new ChatAppearancePreferencesView(
                defaults.defaultThemeId(),
                defaults.defaultBubbleStyleId(),
                rooms.stream().map(this::toRoomView).toList());
    }

    @PutMapping
    public ResponseEntity<Void> update(
            @RequestBody @Valid CanonicalApiContracts.ChatAppearancePreferencesRequest request) {
        backend.updateChatAppearancePreferences(actorId(), request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/rooms/{conversationId}")
    public ResponseEntity<Void> updateRoom(
            @PathVariable UUID conversationId,
            @RequestBody @Valid CanonicalApiContracts.ConversationAppearancePreferencesRequest request) {
        backend.updateConversationAppearancePreferences(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rooms/{conversationId}")
    public ResponseEntity<Void> resetRoom(@PathVariable UUID conversationId) {
        backend.deleteConversationAppearancePreferences(actorId(), conversationId);
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
