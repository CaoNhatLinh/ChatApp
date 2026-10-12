package com.chatapp.chat_service.canonical.appearance;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;

import java.util.List;
import java.util.UUID;

public interface AppearanceRepository {
    CanonicalChatPreferences findUserPreferences(UUID userId);

    void saveUserPreferences(CanonicalChatPreferences preferences);

    List<CanonicalConversationPreferences> findConversationPreferences(UUID userId, int limit);

    void saveConversationPreferences(CanonicalConversationPreferences preferences);

    void deleteConversationPreferences(UUID userId, UUID conversationId);
}
