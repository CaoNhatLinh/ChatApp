package com.chatapp.chat_service.redis.scheduler;

import com.chatapp.chat_service.presence.service.PresenceService;
import com.chatapp.chat_service.websocket.service.WebSocketConnectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Scheduler dọn dẹp các session rác trong Redis nếu có sự cố (Server crash, miss event).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RedisCleanupScheduler {

    private final RedisTemplate<String, String> redisTemplate;
    private final WebSocketConnectionService webSocketConnectionService;
    private final PresenceService presenceService;

    /**
     * Mỗi 5 phút dọn dẹp WebSocket Connections
     */
    @Scheduled(fixedRate = 300000)
    public void cleanupWebSocketConnections() {
        try {
            log.info("Running scheduled cleanup for WebSocket connections...");
            webSocketConnectionService.cleanupExpiredSessions();
        } catch (Exception e) {
            log.error("Error during WebSocket connections cleanup: {}", e.getMessage(), e);
        }
    }

    /**
     * Mỗi 5 phút dọn dẹp các session bị kẹt trong PresenceService
     */
    @Scheduled(fixedRate = 300000)
    public void cleanupPresenceSessions() {
        try {
            log.info("Running scheduled cleanup for Presence sessions...");
            
            Set<String> userSessionKeys = new HashSet<>();
            redisTemplate.execute((RedisCallback<Void>) connection -> {
                Cursor<byte[]> cursor = connection.scan(
                        ScanOptions.scanOptions().match("presence:sessions:*").count(100).build()
                );
                while (cursor.hasNext()) {
                    userSessionKeys.add(new String(cursor.next()));
                }
                return null;
            });
            
            if (userSessionKeys == null || userSessionKeys.isEmpty()) {
                return;
            }

            int cleanedUsers = 0;
            int cleanedSessions = 0;

            for (String userKey : userSessionKeys) {
                String userIdStr = userKey.replace("presence:sessions:", "");
                UUID userId;
                try {
                    userId = UUID.fromString(userIdStr);
                } catch (IllegalArgumentException e) {
                    continue; 
                }

                Set<String> sessions = redisTemplate.opsForSet().members(userKey);
                if (sessions != null && !sessions.isEmpty()) {
                    for (String sessionId : sessions) {
                        String heartbeatKey = String.format("presence:hb:%s:%s", userIdStr, sessionId);
                        if (!Boolean.TRUE.equals(redisTemplate.hasKey(heartbeatKey))) {
                            redisTemplate.opsForSet().remove(userKey, sessionId);
                            cleanedSessions++;
                        }
                    }

                    Long remainingSize = redisTemplate.opsForSet().size(userKey);
                    if (remainingSize == null || remainingSize == 0) {
                        log.warn("Force offline user {} due to missing heartbeats (Garbage Collected)", userId);
                        presenceService.handleExpiredSession(userId, "gc-cleanup");
                        cleanedUsers++;
                    }
                } else {
                    redisTemplate.delete(userKey);
                }
            }
            if(cleanedSessions > 0) {
                log.info("Presence Cleanup completed: force offline {} users, cleaned {} ghost sessions", cleanedUsers, cleanedSessions);
            }
        } catch (Exception e) {
            log.error("Error during Presence sessions cleanup: {}", e.getMessage(), e);
        }
    }
}
