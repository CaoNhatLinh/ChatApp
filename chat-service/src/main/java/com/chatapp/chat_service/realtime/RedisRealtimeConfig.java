package com.chatapp.chat_service.realtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

import java.nio.charset.StandardCharsets;

@Configuration
public class RedisRealtimeConfig {
    @Bean
    RedisMessageListenerContainer realtimeRedisListener(
            RedisConnectionFactory connectionFactory,
            TypingService typingService,
            PresenceService presenceService,
            @Value("${app.redis.typing-channel:chat:realtime:typing}") String typingChannel,
            @Value("${app.redis.presence-channel:chat:realtime:presence}") String presenceChannel) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(
                (message, pattern) -> typingService.forwardRedisPayload(
                        new String(message.getBody(), StandardCharsets.UTF_8)),
                new ChannelTopic(typingChannel));
        container.addMessageListener(
                (message, pattern) -> presenceService.forwardRedisPayload(
                        new String(message.getBody(), StandardCharsets.UTF_8)),
                new ChannelTopic(presenceChannel));
        return container;
    }
}
