package com.chatapp.chat_service.redis.subscriber;


import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class RedisCacheEvictSubscriber implements MessageListener {

    private final RedisTemplate<String, Object> redisTemplate;

    public RedisCacheEvictSubscriber(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String cacheKey = new String(message.getBody());
        redisTemplate.delete(cacheKey);
        System.out.println("[Redis] Evicted cache: " + cacheKey);
    }
}