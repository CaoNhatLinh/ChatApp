package com.chatapp.chat_service.redis.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

import com.chatapp.chat_service.redis.listener.RedisKeyExpirationListener;

@Configuration
@RequiredArgsConstructor
public class RedisExpirationConfig {

    private final RedisKeyExpirationListener redisKeyExpirationListener;

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(RedisConnectionFactory connectionFactory) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        
        container.addMessageListener(
            new MessageListenerAdapter(redisKeyExpirationListener),
            new PatternTopic("__keyevent@*__:expired")
        );
        
        System.out.println("Redis key expiration listener configured successfully");
        return container;
    }
}
