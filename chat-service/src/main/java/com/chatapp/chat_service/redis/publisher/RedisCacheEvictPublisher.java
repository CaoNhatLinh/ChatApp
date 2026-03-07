package com.chatapp.chat_service.redis.publisher;


import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.stereotype.Service;

@Service
public class RedisCacheEvictPublisher {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ChannelTopic cacheEvictTopic;

    public RedisCacheEvictPublisher(
            RedisTemplate<String, Object> redisTemplate,
            ChannelTopic cacheEvictTopic
    ) {
        this.redisTemplate = redisTemplate;
        this.cacheEvictTopic = cacheEvictTopic;
    }

    public void publish(String cacheKey) {
        redisTemplate.convertAndSend(cacheEvictTopic.getTopic(), cacheKey);
        System.out.println("[Redis] Published cache evict: " + cacheKey);
    }
}