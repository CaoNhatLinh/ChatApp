package com.chatapp.chat_service.common.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
@ConditionalOnProperty(prefix = "app.integrations.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class KafkaTopicConfig {

    @Bean
    NewTopic domainEventsTopic(
            @Value("${app.kafka.topics.domain-events}") String topicName,
            @Value("${app.kafka.topics.partitions:6}") int partitions,
            @Value("${app.kafka.topics.replication-factor:1}") int replicationFactor) {
        return topic(topicName, partitions, replicationFactor);
    }

    @Bean
    NewTopic deadLetterTopic(
            @Value("${app.kafka.topics.dead-letter}") String topicName,
            @Value("${app.kafka.topics.partitions:6}") int partitions,
            @Value("${app.kafka.topics.replication-factor:1}") int replicationFactor) {
        return topic(topicName, partitions, replicationFactor);
    }

    private NewTopic topic(String name, int partitions, int replicationFactor) {
        if (partitions < 1 || replicationFactor < 1) {
            throw new IllegalArgumentException("Kafka topic partitions and replication factor must be positive");
        }

        // Spring Boot discovers NewTopic beans and creates missing topics:
        // https://docs.spring.io/spring-boot/reference/messaging/kafka.html
        return TopicBuilder.name(name)
                .partitions(partitions)
                .replicas(replicationFactor)
                .build();
    }
}
