package com.chatapp.chat_service.canonical.messaging;

import java.util.UUID;

public interface RealtimePublisher {

    void publishToUser(UUID userId, String destination, Object payload);

    void publishToConversation(UUID conversationId, String destinationSuffix, Object payload);
}
