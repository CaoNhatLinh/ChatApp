package com.chatapp.chat_service.canonical.messaging;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@Testcontainers
class ReportOutboxKafkaIT {
    @Container
    static final KafkaContainer broker = new KafkaContainer("apache/kafka:3.9.1");

    @Test
    void oldRecoveredEventReachesBrokerWithOriginalIdentityAndProducesAReceipt() throws Exception {
        String topic = "report-recovery-" + UUID.randomUUID();
        Map<String, Object> connection = Map.of("bootstrap.servers", broker.getBootstrapServers());
        try (AdminClient admin = AdminClient.create(connection)) {
            admin.createTopics(List.of(new NewTopic(topic, 1, (short) 1))).all().get(20, TimeUnit.SECONDS);
        }

        var outbox = mock(OutboxRepository.class);
        Instant occurredAt = Instant.parse("2025-12-31T23:59:59Z");
        UUID eventId = Uuids.startOf(occurredAt.toEpochMilli());
        UUID reportId = UUID.randomUUID();
        String payload = "{\"eventId\":\"" + eventId + "\",\"createdAt\":\"" + occurredAt + "\"}";
        int shard = Math.floorMod(reportId.hashCode(), ReportOutboxRoute.SHARDS);
        String partition = ReportOutboxRoute.partition(shard);
        var event = new OutboxRepository.OutboxEvent(partition, eventId, "report", reportId.toString(),
                "REPORT_STATUS_UPDATE", payload, occurredAt, null, 0);
        when(outbox.findReportPending(anyString(), isNull(), eq(25)))
                .thenReturn(new OutboxRepository.ReportPendingPage(List.of(), null));
        when(outbox.findReportPending(partition, null, 25))
                .thenReturn(new OutboxRepository.ReportPendingPage(List.of(event), eventId));
        when(outbox.findPending(anyString(), anyInt())).thenReturn(List.of());

        var factory = new DefaultKafkaProducerFactory<String, String>(Map.of(
                "bootstrap.servers", broker.getBootstrapServers(),
                "key.serializer", StringSerializer.class, "value.serializer", StringSerializer.class, "acks", "all"));
        try (var consumer = new KafkaConsumer<String, String>(
                Map.of("bootstrap.servers", broker.getBootstrapServers(), "enable.auto.commit", false),
                new StringDeserializer(), new StringDeserializer())) {
            var topicPartition = new TopicPartition(topic, 0);
            consumer.assign(List.of(topicPartition));
            consumer.seekToBeginning(List.of(topicPartition));
            var producer = new KafkaDomainEventPublisher(new KafkaTemplate<>(factory), topic, Duration.ofSeconds(20));
            var publisher = new CassandraOutboxPublisher(outbox, producer, 25, 1);
            for (int tick = 0; tick <= shard; tick++) publisher.publishPending();

            verify(outbox).recordPublishAttempt(eq(event), any(Instant.class));
            var received = consumer.poll(Duration.ofSeconds(15)).records(topicPartition);
            assertThat(received).singleElement().satisfies(record -> {
                assertThat(record.key()).isEqualTo(reportId.toString());
                assertThat(record.value()).isEqualTo(payload);
                assertThat(new String(record.headers().lastHeader("eventId").value(), StandardCharsets.UTF_8))
                        .isEqualTo(eventId.toString());
                assertThat(new String(record.headers().lastHeader("eventType").value(), StandardCharsets.UTF_8))
                        .isEqualTo("REPORT_STATUS_UPDATE");
            });
        } finally {
            factory.destroy();
        }
    }
}
