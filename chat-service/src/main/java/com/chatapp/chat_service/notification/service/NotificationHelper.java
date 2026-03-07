package com.chatapp.chat_service.notification.service;

import com.chatapp.chat_service.notification.dto.NotificationDto;
import com.chatapp.chat_service.notification.entity.Notification;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Shared helper methods for notification services:
 * DTO mapping, metadata serialization, cache, realtime delivery
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationHelper {

    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public NotificationDto mapToDto(Notification notification) {
        return NotificationDto.builder()
                .notificationId(notification.getNotificationId())
                .userId(notification.getUserId())
                .title(notification.getTitle())
                .body(notification.getBody())
                .type(notification.getType())
                .metadata(deserializeMetadata(notification.getMetadata()))
                .isRead(notification.getIsRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }

    public String serializeMetadata(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize metadata", e);
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> deserializeMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.trim().isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(metadataJson, Map.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize metadata", e);
            return new HashMap<>();
        }
    }

    /**
     * Redis key format for user custom status — MUST match PresenceService.CUSTOM_STATUS_KEY.
     * Format: presence:custom_status:{userId}
     */
    private static final String CUSTOM_STATUS_KEY = "presence:custom_status:%s";

    /**
     * Send realtime notification to user via WebSocket.
     * Respects DND (Do Not Disturb) status: notifications are saved to DB
     * but NOT pushed in realtime when user is DND.
     */
    public void sendRealtimeNotification(UUID userId, NotificationDto notification) {
        String customStatusKey = String.format(CUSTOM_STATUS_KEY, userId);
        Object statusObj = redisTemplate.opsForValue().get(customStatusKey);
        String currentStatus = statusObj != null ? statusObj.toString() : null;

        if ("DND".equals(currentStatus)) {
            log.debug("User {} is DND, notification saved to DB but not pushed realtime", userId);
            return; 
        }

        messagingTemplate.convertAndSendToUser(userId.toString(), "/queue/notifications", notification);
    }

    public void sendRealtimeUpdate(UUID userId, String destination, Map<String, Object> update) {
        messagingTemplate.convertAndSendToUser(userId.toString(), destination, update);
    }

    public void clearUserNotificationCache(UUID userId) {
        String pattern = "*notifications*:" + userId + "*";
        redisTemplate.execute((org.springframework.data.redis.core.RedisCallback<Void>) connection -> {
            try (org.springframework.data.redis.core.Cursor<byte[]> cursor = connection.keyCommands()
                    .scan(org.springframework.data.redis.core.ScanOptions.scanOptions().match(pattern).count(100).build())) {
                while (cursor.hasNext()) {
                    connection.keyCommands().del(cursor.next());
                }
            } catch (Exception e) {
                log.error("Error scanning and deleting keys for user " + userId, e);
            }
            return null;
        });
        
        redisTemplate.delete("unread_notifications:" + userId);
    }

    public void incrementUnreadCount(UUID userId) {
        String key = "unread_count:" + userId;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(key))) {
            redisTemplate.opsForValue().increment(key);
        }
        redisTemplate.delete("notification_stats:" + userId);
    }

    public void decrementUnreadCount(UUID userId, int amount) {
        String key = "unread_count:" + userId;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(key))) {
            Long count = redisTemplate.opsForValue().decrement(key, amount);
            if (count != null && count < 0) {
                redisTemplate.opsForValue().set(key, 0, java.time.Duration.ofMinutes(5));
            }
        }
        redisTemplate.delete("notification_stats:" + userId);
    }

    public void invalidateUnreadCount(UUID userId) {
        redisTemplate.delete("unread_count:" + userId);
        redisTemplate.delete("notification_stats:" + userId);
    }
}
