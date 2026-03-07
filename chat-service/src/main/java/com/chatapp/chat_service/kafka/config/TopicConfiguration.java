package com.chatapp.chat_service.kafka.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
@Slf4j
public class TopicConfiguration {

    private final int REPLICAS = 1;

    @Bean
    public NewTopic messageTopic() {
        return TopicBuilder.name("message-topic")
                .partitions(3)
                .replicas(REPLICAS)
                .build();
    }

    @Bean
    public NewTopic friendRequestTopic() {
        return TopicBuilder.name("friend-requests-topic")
                .partitions(1)
                .replicas(REPLICAS)
                .build();
    }
    
    @Bean
    public NewTopic friendshipStatusTopic() {
        return TopicBuilder.name("friendship-status-events")
                .partitions(1)
                .replicas(REPLICAS)
                .build();
    }

    @Bean
    public NewTopic messageReactionTopic() {
        return TopicBuilder.name("message-reaction-topic")
                .partitions(2)
                .replicas(REPLICAS)
                .build();
    }

    @Bean
    public NewTopic messageReadTopic() {
        return TopicBuilder.name("message-read-topic")
                .partitions(2)
                .replicas(REPLICAS)
                .build();
    }
    
    @Bean
    public NewTopic messagePinTopic() {
        return TopicBuilder.name("message-pin-topic")
                .partitions(2)
                .replicas(REPLICAS)
                .build();
    }
    
    @Bean
    public NewTopic messageAttachmentTopic() {
        return TopicBuilder.name("message-attachment-topic")
                .partitions(2)
                .replicas(REPLICAS)
                .build();
    }
    
    @Bean
    public NewTopic notificationTopic() {
        return TopicBuilder.name("notification-topic")
                .partitions(1)
                .replicas(REPLICAS)
                .build();
    }
}