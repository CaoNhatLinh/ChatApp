package com.chatapp.chat_service.conversation.service;

import com.chatapp.chat_service.message.dto.MessageSummary;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.Cursor;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationCacheService {

    private static final String CACHE_KEY_PREFIX = "conv:last_msg:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    public void cacheLastMessage(UUID conversationId, MessageSummary summary) {
        try {
            String key = CACHE_KEY_PREFIX + conversationId;
            String value = objectMapper.writeValueAsString(summary);
            redisTemplate.opsForValue().set(key, value, CACHE_TTL);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize message summary for caching", e);
        }
    }

    public Optional<MessageSummary> getCachedLastMessage(UUID conversationId) {
        try {
            String key = CACHE_KEY_PREFIX + conversationId;
            Object value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                String jsonValue = value.toString();
                return Optional.of(objectMapper.readValue(jsonValue, MessageSummary.class));
            }
        } catch (Exception e) {
            log.error("Failed to deserialize cached message summary", e);
        }
        return Optional.empty();
    }

    public void evictCache(UUID conversationId) {
        String key = CACHE_KEY_PREFIX + conversationId;
        redisTemplate.delete(key);
    }

    /**
     * Xóa tất cả cache liên quan đến conversation
     *
     * @param conversationId ID của conversation
     */
    public void clearConversationCache(String conversationId) {
        try {
            String dmKey = "dm_conversation:" + conversationId;
            redisTemplate.delete(dmKey);
            log.debug("Cleared DM conversation cache: {}", dmKey);

            String convKey = "conversation:" + conversationId;
            redisTemplate.delete(convKey);
            log.debug("Cleared conversation cache: {}", convKey);

            String membersKey = "conversation_members:" + conversationId;
            redisTemplate.delete(membersKey);
            log.debug("Cleared conversation members cache: {}", membersKey);

            String messagePattern = "message:" + conversationId + ":*";
            java.util.Set<String> messageKeys = new java.util.HashSet<>();
            try {
                redisTemplate.execute((org.springframework.data.redis.core.RedisCallback<Void>) connection -> {
                    Cursor<byte[]> cursor = connection.scan(
                            ScanOptions.scanOptions().match(messagePattern).count(100).build()
                    );
                    while (cursor.hasNext()) {
                        messageKeys.add(new String(cursor.next()));
                    }
                    return null;
                });
            } catch (Exception scanEx) {
                log.error("Error scanning message cache keys: {}", scanEx.getMessage(), scanEx);
            }
            if (!messageKeys.isEmpty()) {
                redisTemplate.delete(messageKeys);
                log.debug("Cleared {} message cache entries for conversation: {}", messageKeys.size(), conversationId);
            }

            evictCache(UUID.fromString(conversationId));

        } catch (Exception e) {
            log.error("Error clearing conversation cache for {}: {}", conversationId, e.getMessage(), e);
        }
    }

    /**
     * Xóa cache user conversations cho một user
     *
     * @param userId ID của user
     */
    public void clearUserConversationsCache(String userId) {
        try {
            String pattern = "user_conversations:" + userId + ":*";
            java.util.Set<String> keys = new java.util.HashSet<>();
            try {
                redisTemplate.execute((org.springframework.data.redis.core.RedisCallback<Void>) connection -> {
                    Cursor<byte[]> cursor = connection.scan(
                            ScanOptions.scanOptions().match(pattern).count(100).build()
                    );
                    while (cursor.hasNext()) {
                        keys.add(new String(cursor.next()));
                    }
                    return null;
                });
            } catch (Exception scanEx) {
                log.error("Error scanning user conversations cache: {}", scanEx.getMessage(), scanEx);
            }
            if (!keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.debug("Cleared {} user conversations cache entries for user: {}", keys.size(), userId);
            }
        } catch (Exception e) {
            log.error("Error clearing user conversations cache for {}: {}", userId, e.getMessage(), e);
        }
    }

    /**
     * Xóa cache cho typing users trong conversation
     *
     * @param conversationId ID của conversation
     */
    public void clearTypingCache(String conversationId) {
        try {
            String typingKey = "typing_users:" + conversationId;
            redisTemplate.delete(typingKey);
            log.debug("Cleared typing cache: {}", typingKey);
        } catch (Exception e) {
            log.error("Error clearing typing cache for {}: {}", conversationId, e.getMessage(), e);
        }
    }

    /**
     * Xóa tất cả cache theo pattern
     *
     * @param pattern Pattern để tìm cache keys
     * @return Số lượng entries đã xóa
     */
    public long clearCacheByPattern(String pattern) {
        try {
            long deletedCount = 0;
            ScanOptions scanOptions = ScanOptions.scanOptions()
                    .match(pattern)
                    .count(100)
                    .build();

            try (Cursor<byte[]> cursor = redisTemplate.getConnectionFactory()
                    .getConnection()
                    .scan(scanOptions)) {

                List<String> keysToDelete = new ArrayList<>();
                while (cursor.hasNext()) {
                    keysToDelete.add(new String(cursor.next()));

                    if (keysToDelete.size() >= 100) {
                        Long deleted = redisTemplate.delete(keysToDelete);
                        deletedCount += deleted != null ? deleted : 0;
                        keysToDelete.clear();
                    }
                }

                if (!keysToDelete.isEmpty()) {
                    Long deleted = redisTemplate.delete(keysToDelete);
                    deletedCount += deleted != null ? deleted : 0;
                }
            }

            log.debug("Cleared {} cache entries for pattern: {}", deletedCount, pattern);
            return deletedCount;

        } catch (Exception e) {
            log.error("Error clearing cache by pattern {}: {}", pattern, e.getMessage(), e);
            return 0;
        }
    }

    /**
     * Kiểm tra xem có bao nhiêu cache entries cho một pattern
     *
     * @param pattern Pattern để tìm
     * @return Số lượng cache entries
     */
    public long countCacheEntries(String pattern) {
        try {
            long count = 0;
            ScanOptions scanOptions = ScanOptions.scanOptions()
                    .match(pattern)
                    .count(100)
                    .build();

            try (Cursor<byte[]> cursor = redisTemplate.getConnectionFactory()
                    .getConnection()
                    .scan(scanOptions)) {
                while (cursor.hasNext()) {
                    cursor.next();
                    count++;
                }
            }

            return count;
        } catch (Exception e) {
            log.error("Error counting cache entries for pattern {}: {}", pattern, e.getMessage(), e);
            return 0;
        }
    }

    public void onMessageDeleted(UUID conversationId, UUID messageId) {
        evictCache(conversationId);
        clearConversationCache(conversationId.toString());
        log.info("Cache invalidated for conversation {} after message {} deletion",
                conversationId, messageId);
    }

    public void onMessageEdited(UUID conversationId, UUID messageId) {
        evictCache(conversationId);
        log.info("Cache invalidated for conversation {} after message {} edit",
                conversationId, messageId);
    }

   
    public void onConversationUpdated(UUID conversationId, java.util.Set<UUID> memberIds) {
        evictCache(conversationId);
        clearConversationCache(conversationId.toString());

        if (memberIds != null) {
            memberIds.forEach(userId -> clearUserConversationsCache(userId.toString()));
        }

        log.info("Cache invalidated for conversation {} and {} members",
                conversationId, memberIds != null ? memberIds.size() : 0);
    }

    /**
     * Health check cho cache
     *
     * @return true nếu Redis connection OK
     */
    public boolean isHealthy() {
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            return true;
        } catch (Exception e) {
            log.error("Redis health check failed: {}", e.getMessage());
            return false;
        }
    }
}