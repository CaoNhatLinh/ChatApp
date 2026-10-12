package com.chatapp.chat_service.canonical.messaging;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class StompRealtimePublisherTest {

    private final SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
    private final StompRealtimePublisher publisher = new StompRealtimePublisher(messaging);

    @Test
    void publishesUserEventsToTheCanonicalUserQueue() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("eventType", "NOTIFICATION_CREATED");

        publisher.publishToUser(userId, "/queue/notifications", payload);

        verify(messaging).convertAndSendToUser(userId.toString(), "/queue/notifications", payload);
    }

    @Test
    void publishesConversationEventsToTheCanonicalConversationTopic() {
        UUID conversationId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("eventType", "MESSAGE_SEND");

        publisher.publishToConversation(conversationId, "/reactions", payload);

        verify(messaging).convertAndSend(
                "/topic/conversation/" + conversationId + "/reactions", payload);
    }
}
