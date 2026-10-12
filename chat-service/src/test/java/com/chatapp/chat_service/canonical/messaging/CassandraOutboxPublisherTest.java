package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.messaging.OutboxRepository.OutboxEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraOutboxPublisherTest {
    @Mock OutboxRepository outbox;
    @Mock DomainEventPublisher eventPublisher;

    @Test
    void marksPublishedOnlyAfterTheTransportAcknowledgesTheEvent() {
        OutboxEvent event = new OutboxEvent(
                "2026-07-22-01", UUID.randomUUID(), "message", "message-1",
                "MESSAGE_SEND", "{\"ok\":true}", Instant.now(), null, 0);
        when(outbox.findPending(anyString(), anyInt()))
                .thenReturn(List.of(event))
                .thenReturn(List.of());
        when(eventPublisher.publishBatch(any())).thenReturn(List.of(true));
        CassandraOutboxPublisher publisher = new CassandraOutboxPublisher(
                outbox, eventPublisher, 10, 2);

        publisher.publishPending();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DomainEvent>> eventCaptor = ArgumentCaptor.forClass(List.class);
        verify(eventPublisher).publishBatch(eventCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(eventCaptor.getValue()).singleElement()
                .extracting(DomainEvent::aggregateId).isEqualTo("message-1");
        verify(outbox).recordPublishAttempt(any(OutboxEvent.class), any(Instant.class));
    }

    @Test
    void keepsTheEventPendingWhenTheTransportRejectsIt() {
        OutboxEvent event = new OutboxEvent(
                "2026-07-22-01", UUID.randomUUID(), "message", "message-1",
                "MESSAGE_SEND", "{\"ok\":true}", Instant.now(), null, 2);
        when(outbox.findPending(anyString(), anyInt()))
                .thenReturn(List.of(event))
                .thenReturn(List.of());
        when(eventPublisher.publishBatch(any())).thenReturn(List.of(false));
        CassandraOutboxPublisher publisher = new CassandraOutboxPublisher(
                outbox, eventPublisher, 10, 2);

        publisher.publishPending();

        verify(outbox).recordPublishAttempt(event, null);
    }
}
