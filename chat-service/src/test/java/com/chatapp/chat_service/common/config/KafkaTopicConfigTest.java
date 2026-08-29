package com.chatapp.chat_service.common.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DefaultErrorHandler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class KafkaTopicConfigTest {

    private final KafkaTopicConfig config = new KafkaTopicConfig();

    @Test
    void buildsDomainTopicFromConfiguredValues() {
        NewTopic topic = config.domainEventsTopic("chat.domain-events.v1", 6, 1);

        assertThat(topic.name()).isEqualTo("chat.domain-events.v1");
        assertThat(topic.numPartitions()).isEqualTo(6);
        assertThat(topic.replicationFactor()).isEqualTo((short) 1);
    }

    @Test
    void rejectsInvalidTopicSizing() {
        assertThatThrownBy(() -> config.deadLetterTopic("chat.dlt", 0, 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("positive");
    }

    @Test
    void configuresBoundedConsumerRecovery() {
        KafkaConsumerConfig consumerConfig = new KafkaConsumerConfig();

        CommonErrorHandler handler = consumerConfig.kafkaErrorHandler(
                mock(KafkaTemplate.class), "chat.domain-events.dlt.v1");

        assertThat(handler).isInstanceOf(DefaultErrorHandler.class);
    }
}
