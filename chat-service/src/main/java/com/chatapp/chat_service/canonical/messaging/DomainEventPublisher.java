package com.chatapp.chat_service.canonical.messaging;

import java.util.List;

public interface DomainEventPublisher {

    boolean publish(DomainEvent event);

    default List<Boolean> publishBatch(List<DomainEvent> events) {
        return events.stream().map(this::publish).toList();
    }
}
