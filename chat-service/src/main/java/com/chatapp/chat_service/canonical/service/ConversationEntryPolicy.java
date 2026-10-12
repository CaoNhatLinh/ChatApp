package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.moderation.ConversationModerationRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class ConversationEntryPolicy {
    private final ConversationModerationRepository moderation;

    public ConversationEntryPolicy(ConversationModerationRepository moderation) {
        this.moderation = moderation;
    }

    public boolean isBanned(UUID conversationId, UUID userId) {
        return moderation.isBanned(conversationId, userId, Instant.now());
    }
}
