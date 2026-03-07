package com.chatapp.chat_service.websocket.service;

import com.chatapp.chat_service.redis.config.RedisConfig;
import com.chatapp.chat_service.websocket.event.TypingEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Service quản lý typing indicators
 * Sử dụng Redis với TTL để tự động hết hạn typing status
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TypingIndicatorService {
    
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisTemplate<String, Object> objectRedisTemplate;
    
    private static final String TYPING_KEY = "conversation:typing:%s:%s";
    private static final int TYPING_TTL = 5; 
    
    /**
     * Bắt đầu typing trong conversation
     * @param conversationId ID của conversation
     * @param userId ID của user đang typing
     */
    public void startTyping(UUID conversationId, UUID userId) {
        String key = String.format(TYPING_KEY, conversationId, userId);
        redisTemplate.opsForValue().set(key, "typing");
        redisTemplate.expire(key, TYPING_TTL, TimeUnit.SECONDS);
        
        log.debug("User {} started typing in conversation {} (TTL: {}s)", userId, conversationId, TYPING_TTL);
    }
    
    /**
     * Dừng typing trong conversation
     * @param conversationId ID của conversation
     * @param userId ID của user dừng typing
     */
    public void stopTyping(UUID conversationId, UUID userId) {
        String key = String.format(TYPING_KEY, conversationId, userId);
        redisTemplate.delete(key);
        
        log.debug("User {} stopped typing in conversation {}", userId, conversationId);
    }
    
    /**
     * Lấy danh sách users đang typing trong conversation
     * @param conversationId ID của conversation
     * @return List các user IDs đang typing
     */
    public List<UUID> getTypingUsers(UUID conversationId) {
        String pattern = String.format("conversation:typing:%s:*", conversationId);
        Set<String> keys = scanKeys(pattern);
        
        if (keys.isEmpty()) {
            return List.of();
        }
        
        List<UUID> typingUsers = keys.stream()
                .map(key -> {
                    String[] parts = key.split(":");
                    return UUID.fromString(parts[3]); 
                })
                .collect(Collectors.toList());
        
        log.debug("Current typing users in conversation {}: {}", conversationId, typingUsers);
        return typingUsers;
    }
    
    /**
     * Kiểm tra user có đang typing trong conversation không
     * @param conversationId ID của conversation
     * @param userId ID của user
     * @return true nếu user đang typing
     */
    public boolean isUserTyping(UUID conversationId, UUID userId) {
        String key = String.format(TYPING_KEY, conversationId, userId);
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }
    
    /**
     * Xóa tất cả typing indicators của conversation
     * @param conversationId ID của conversation
     */
    public void clearAllTyping(UUID conversationId) {
        String pattern = String.format("conversation:typing:%s:*", conversationId);
        Set<String> keys = scanKeys(pattern);
        
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.debug("Cleared all typing indicators for conversation: {}", conversationId);
        }
    }
    
    /**
     * Xóa tất cả typing indicators của user (cleanup khi user disconnect)
     * @param userId ID của user
     */
    public void clearUserTyping(UUID userId) {
        String pattern = String.format("conversation:typing:*:%s", userId);
        Set<String> keys = scanKeys(pattern);
        
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.debug("Cleared all typing indicators for user: {}", userId);
        }
    }
    
    /**
     * B-13: Use SCAN instead of KEYS to avoid blocking Redis
     */
    private Set<String> scanKeys(String pattern) {
        Set<String> result = new HashSet<>();
        try {
            redisTemplate.execute((RedisCallback<Void>) connection -> {
                Cursor<byte[]> cursor = connection.scan(
                        ScanOptions.scanOptions().match(pattern).count(100).build()
                );
                while (cursor.hasNext()) {
                    result.add(new String(cursor.next()));
                }
                return null;
            });
        } catch (Exception e) {
            log.error("Error scanning Redis for pattern {}: {}", pattern, e.getMessage(), e);
        }
        return result;
    }
    
    /**
     * Broadcast typing event via Redis Pub/Sub for distributed multi-instance support.
     * Extracted from WebSocketChatController to follow SRP.
     */
    public void broadcastTypingEvent(TypingEvent event) {
        try {
            objectRedisTemplate.convertAndSend(RedisConfig.TYPING_TOPIC, event);
        } catch (Exception e) {
            log.error("Error broadcasting typing event: {}", e.getMessage(), e);
        }
    }
}
