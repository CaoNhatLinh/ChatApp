package com.chatapp.chat_service.canonical.messaging;

import java.util.UUID;

public record DomainEvent(
        UUID eventId,
        String aggregateType,
        String aggregateId,
        String eventType,
        String payloadJson,
        int publishAttempt) {
}
