package com.chatapp.chat_service.canonical.messaging;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@SuppressWarnings("unchecked")
class KafkaDomainEventPublisherTest {

    private final KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
    private final KafkaDomainEventPublisher publisher = new KafkaDomainEventPublisher(
            kafka, "chat.domain-events.v1", Duration.ofSeconds(1));

    @Test
    void mapsTheCanonicalEnvelopeToTheKafkaRecord() {
        UUID eventId = UUID.randomUUID();
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(null));

        boolean acknowledged = publisher.publish(new DomainEvent(
                eventId, "message", "message-1", "MESSAGE_SEND", "{\"ok\":true}", 1));

        ArgumentCaptor<ProducerRecord<String, String>> record = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafka).send(record.capture());
        assertThat(acknowledged).isTrue();
        assertThat(record.getValue().topic()).isEqualTo("chat.domain-events.v1");
        assertThat(record.getValue().key()).isEqualTo("message-1");
        assertThat(record.getValue().value()).isEqualTo("{\"ok\":true}");
        assertThat(new String(record.getValue().headers().lastHeader("eventId").value(), StandardCharsets.UTF_8))
                .isEqualTo(eventId.toString());
    }

    @Test
    void reportsARejectedPublishWhenKafkaFails() {
        CompletableFuture<SendResult<String, String>> future = new CompletableFuture<>();
        future.completeExceptionally(new IllegalStateException("broker unavailable"));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(future);

        boolean acknowledged = publisher.publish(new DomainEvent(
                UUID.randomUUID(), "message", "message-1", "MESSAGE_SEND", "{}", 2));

        assertThat(acknowledged).isFalse();
    }

    @Test
    void publishesEveryEventInABoundedBatch() {
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(null));

        List<Boolean> results = publisher.publishBatch(List.of(
                new DomainEvent(UUID.randomUUID(), "message", "message-1", "MESSAGE_SEND", "{}", 1),
                new DomainEvent(UUID.randomUUID(), "message", "message-2", "MESSAGE_SEND", "{}", 1)));

        assertThat(results).containsExactly(true, true);
        verify(kafka, times(2)).send(any(ProducerRecord.class));
    }
}
