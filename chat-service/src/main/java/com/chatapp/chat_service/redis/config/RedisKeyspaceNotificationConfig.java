package com.chatapp.chat_service.redis.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class RedisKeyspaceNotificationConfig implements CommandLineRunner {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            redisTemplate.getConnectionFactory()
                .getConnection()
                .serverCommands()
                .setConfig("notify-keyspace-events", "Ex");
            
            log.info("Redis keyspace notifications enabled for expired events");
        } catch (Exception e) {
            log.error("Failed to enable Redis keyspace notifications: {}", e.getMessage());
            log.warn("Please manually run: CONFIG SET notify-keyspace-events Ex");
        }
    }
}
