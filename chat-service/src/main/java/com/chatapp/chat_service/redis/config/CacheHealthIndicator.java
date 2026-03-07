package com.chatapp.chat_service.redis.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import com.chatapp.chat_service.conversation.service.ConversationCacheService;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CacheHealthIndicator {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ConversationCacheService cacheService;

    /**
     * Kiểm tra tình trạng cache và Redis connection
     * @return Map chứa thông tin health check
     */
    public Map<String, Object> checkHealth() {
        Map<String, Object> health = new HashMap<>();
        
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            
            Map<String, Object> details = new HashMap<>();
            
            details.put("dm_conversations", cacheService.countCacheEntries("dm_conversation:*"));
            details.put("conversations", cacheService.countCacheEntries("conversation:*"));
            details.put("messages", cacheService.countCacheEntries("message:*"));
            details.put("user_conversations", cacheService.countCacheEntries("user_conversations:*"));
            details.put("typing_users", cacheService.countCacheEntries("typing_users:*"));
            
            long totalEntries = details.values().stream()
                    .mapToLong(value -> (Long) value)
                    .sum();
            details.put("total_cache_entries", totalEntries);
            
            try {
                java.util.Properties info = redisTemplate.getConnectionFactory().getConnection().info("memory");
                if (info != null && info.containsKey("used_memory_human")) {
                    String memoryUsage = info.getProperty("used_memory_human");
                    details.put("redis_memory_usage", memoryUsage);
                } else {
                    details.put("redis_memory_usage", "unknown");
                }
            } catch (Exception e) {
                details.put("redis_memory_usage", "unknown");
            }
            
            health.put("status", "UP");
            health.put("details", details);
            
        } catch (Exception e) {
            health.put("status", "DOWN");
            health.put("error", e.getMessage());
            log.error("Cache health check failed: {}", e.getMessage());
        }
        
        return health;
    }

    /**
     * Kiểm tra Redis connection đơn giản
     * @return true nếu Redis hoạt động bình thường
     */
    public boolean isRedisHealthy() {
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            return true;
        } catch (Exception e) {
            log.error("Redis connection check failed: {}", e.getMessage());
            return false;
        }
    }
}
