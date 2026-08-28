package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore.OutboxEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraOutboxPublisherTest {
    @Mock CanonicalCqlStore store;
    @Mock KafkaTemplate<String, String> kafka;

    @Test
    void marksPublishedOnlyAfterKafkaAcknowledgesTheRecord() {
        OutboxEvent event = new OutboxEvent(
                "2026-07-22-01", UUID.randomUUID(), "message", "message-1",
                "MESSAGE_SEND", "{\"ok\":true}", Instant.now(), null, 0);
        when(store.listUnpublishedOutboxEvents(anyString(), anyInt()))
                .thenReturn(List.of(event))
                .thenReturn(List.of());
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(null));
        CassandraOutboxPublisher publisher = new CassandraOutboxPublisher(
                store, kafka, "chat.domain-events.v1", 10, 2, Duration.ofSeconds(1));

        publisher.publishPending();

        ArgumentCaptor<ProducerRecord<String, String>> record = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafka).send(record.capture());
        assertThat(record.getValue().key()).isEqualTo("message-1");
        verify(store).markOutboxPublishAttempt(any(OutboxEvent.class), any(Instant.class));
    }
}
