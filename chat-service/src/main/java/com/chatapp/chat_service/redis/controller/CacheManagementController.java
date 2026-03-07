package com.chatapp.chat_service.redis.controller;

import com.chatapp.chat_service.conversation.service.ConversationCacheService;
import com.chatapp.chat_service.redis.config.CacheHealthIndicator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/admin/cache")
@RequiredArgsConstructor
public class CacheManagementController {

    private final ConversationCacheService cacheService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final CacheHealthIndicator cacheHealthIndicator;

    /**
     * Xóa tất cả cache
     */
    @DeleteMapping("/clear/all")
    public ResponseEntity<Map<String, Object>> clearAllCache() {
        try {
            long totalDeleted = 0;
            Map<String, Long> deletedByPattern = new HashMap<>();

            String[] patterns = {
                    "dm_conversation:*",
                    "user_conversations:*", 
                    "conversation:*",
                    "message:*",
                    "typing_users:*",
                    "conv:last_msg:*"
            };

            for (String pattern : patterns) {
                long deleted = cacheService.clearCacheByPattern(pattern);
                deletedByPattern.put(pattern, deleted);
                totalDeleted += deleted;
            }

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "All cache cleared successfully");
            response.put("totalDeleted", totalDeleted);
            response.put("deletedByPattern", deletedByPattern);

            log.info("Manual cache clear: {} entries deleted", totalDeleted);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error clearing all cache: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Xóa cache cho một conversation cụ thể
     */
    @DeleteMapping("/clear/conversation/{conversationId}")
    public ResponseEntity<Map<String, Object>> clearConversationCache(@PathVariable String conversationId) {
        try {
            cacheService.clearConversationCache(conversationId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Conversation cache cleared successfully");
            response.put("conversationId", conversationId);

            log.info("Manual conversation cache clear for: {}", conversationId);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error clearing conversation cache for {}: {}", conversationId, e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Xóa cache cho một user cụ thể
     */
    @DeleteMapping("/clear/user/{userId}")
    public ResponseEntity<Map<String, Object>> clearUserCache(@PathVariable String userId) {
        try {
            cacheService.clearUserConversationsCache(userId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "User cache cleared successfully");
            response.put("userId", userId);

            log.info("Manual user cache clear for: {}", userId);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error clearing user cache for {}: {}", userId, e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Lấy thống kê cache
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getCacheStats() {
        try {
            Map<String, Object> stats = new HashMap<>();
            
            stats.put("dm_conversations", cacheService.countCacheEntries("dm_conversation:*"));
            stats.put("conversations", cacheService.countCacheEntries("conversation:*"));
            stats.put("messages", cacheService.countCacheEntries("message:*"));
            stats.put("user_conversations", cacheService.countCacheEntries("user_conversations:*"));
            stats.put("typing_users", cacheService.countCacheEntries("typing_users:*"));
            stats.put("last_messages", cacheService.countCacheEntries("conv:last_msg:*"));
            
            long total = stats.values().stream()
                    .mapToLong(value -> (Long) value)
                    .sum();
            stats.put("total_entries", total);
            
            stats.put("redis_healthy", cacheService.isHealthy());

            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            log.error("Error getting cache stats: {}", e.getMessage(), e);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Test Redis connection và lấy thông tin health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        try {
            Map<String, Object> health = cacheHealthIndicator.checkHealth();
            
            if ("UP".equals(health.get("status"))) {
                return ResponseEntity.ok(health);
            } else {
                return ResponseEntity.status(503).body(health);
            }
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "DOWN");
            response.put("error", e.getMessage());
            return ResponseEntity.status(503).body(response);
        }
    }
}
