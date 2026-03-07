package com.chatapp.chat_service.redis.config;

import com.chatapp.chat_service.redis.listener.RedisTypingListener;
import com.chatapp.chat_service.redis.subscriber.RedisCacheEvictSubscriber;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

@Configuration
@RequiredArgsConstructor
public class RedisPubSubConfig {

    private final RedisTypingListener redisTypingListener;
    private final RedisCacheEvictSubscriber redisCacheEvictSubscriber;

    @Bean
    public ChannelTopic typingTopic() {
        return new ChannelTopic(RedisConfig.TYPING_TOPIC);
    }

    @Bean
    public MessageListenerAdapter typingListenerAdapter() {
        return new MessageListenerAdapter(redisTypingListener, "onMessage");
    }

    @Bean
    public MessageListenerAdapter cacheEvictListenerAdapter() {
        return new MessageListenerAdapter(redisCacheEvictSubscriber, "onMessage");
    }

    @Bean
    public RedisMessageListenerContainer pubSubListenerContainer(
            RedisConnectionFactory connectionFactory) {
            
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        
        container.addMessageListener(typingListenerAdapter(), typingTopic());
        
        container.addMessageListener(cacheEvictListenerAdapter(), new ChannelTopic(RedisConfig.CACHE_EVICT_TOPIC));
        
        return container;
    }
}
