package com.chatapp.chat_service.websocket.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service quản lý các kết nối WebSocket của users với session-based tracking
 * Hỗ trợ đa thiết bị với TTL 60s cho mỗi session
 */
@Service
@RequiredArgsConstructor
public class WebSocketConnectionService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(WebSocketConnectionService.class);

    private final RedisTemplate<String, String> redisTemplate;

    private static final String WS_SESSION_PREFIX = "ws:session:";
    private static final String WS_USER_SESSIONS_PREFIX = "ws:user:sessions:";

    private static final long SESSION_TTL = 60L;

    /**
     * Đăng ký kết nối WebSocket mới cho user với session ID
     * @param userId ID của user
     * @param sessionId Session ID của kết nối
     * @param device Thông tin thiết bị
     */
    public void registerConnection(UUID userId, String sessionId, String device) {
        String sessionKey = WS_SESSION_PREFIX + sessionId;
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;

        String sessionData = String.format("userId=%s,device=%s,timestamp=%s",
                                         userId.toString(), device, Instant.now().toEpochMilli());
        redisTemplate.opsForValue().set(sessionKey, sessionData, Duration.ofSeconds(SESSION_TTL));

        redisTemplate.opsForSet().add(userSessionsKey, sessionId);
        redisTemplate.expire(userSessionsKey, Duration.ofSeconds(SESSION_TTL + 30)); 

        log.info("Registered WebSocket connection for user: {}, session: {}, device: {}",
                userId, sessionId, device);
    }

    /**
     * Overloaded method for backward compatibility
     */
    public void registerConnection(UUID userId) {
        String sessionId = UUID.randomUUID().toString();
        registerConnection(userId, sessionId, "unknown");
    }

    /**
     * Hủy đăng ký kết nối WebSocket của user với session ID
     * @param userId ID của user
     * @param sessionId Session ID của kết nối
     */
    public void unregisterConnection(UUID userId, String sessionId) {
        String sessionKey = WS_SESSION_PREFIX + sessionId;
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;

        redisTemplate.delete(sessionKey);

        redisTemplate.opsForSet().remove(userSessionsKey, sessionId);

        Long remainingCount = redisTemplate.opsForSet().size(userSessionsKey);

        if (remainingCount == null || remainingCount <= 0) {
            redisTemplate.delete(userSessionsKey);
            log.info("Removed all WebSocket connections for user: {}", userId);
        } else {
            log.debug("Unregistered WebSocket connection for user: {}, session: {}, remaining connections: {}",
                     userId, sessionId, remainingCount);
        }
    }

    /**
     * Overloaded method for backward compatibility
     */
    public void unregisterConnection(UUID userId) {
        clearAllConnections(userId);
    }

    /**
     * Refresh session TTL (heartbeat support)
     * @param userId ID của user
     * @param sessionId Session ID cần refresh
     */
    public void refreshSession(UUID userId, String sessionId) {
        String sessionKey = WS_SESSION_PREFIX + sessionId;
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;

        String sessionData = redisTemplate.opsForValue().get(sessionKey);
        if (sessionData != null) {
            String[] parts = sessionData.split(",");
            if (parts.length >= 2) {
                String newSessionData = String.format("userId=%s,device=%s,timestamp=%s",
                                                    userId.toString(),
                                                    parts[1].split("=")[1],
                                                    Instant.now().toEpochMilli());
                redisTemplate.opsForValue().set(sessionKey, newSessionData, Duration.ofSeconds(SESSION_TTL));
            } else {
                redisTemplate.expire(sessionKey, Duration.ofSeconds(SESSION_TTL));
            }
            redisTemplate.expire(userSessionsKey, Duration.ofSeconds(SESSION_TTL + 30));
            log.debug("Refreshed session for user: {}, session: {}", userId, sessionId);
        } else {
            log.warn("Attempted to refresh non-existent session: {} for user: {}", sessionId, userId);
        }
    }

    /**
     * Kiểm tra user có kết nối WebSocket active không
     * @param userId ID của user
     * @return true nếu user có ít nhất 1 kết nối active
     */
    public boolean hasActiveConnection(UUID userId) {
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;
        Set<String> sessions = redisTemplate.opsForSet().members(userSessionsKey);

        if (sessions == null || sessions.isEmpty()) {
            return false;
        }

        for (String sessionId : sessions) {
            String sessionKey = WS_SESSION_PREFIX + sessionId;
            if (Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey))) {
                return true;
            }
        }

        redisTemplate.delete(userSessionsKey);

        return false;
    }

    /**
     * Lấy số lượng kết nối active của user
     * @param userId ID của user
     * @return số lượng kết nối active
     */
    public long getActiveConnectionCount(UUID userId) {
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;
        Set<String> sessions = redisTemplate.opsForSet().members(userSessionsKey);

        if (sessions == null || sessions.isEmpty()) {
            return 0;
        }

        long activeCount = 0;
        List<String> expiredSessions = new ArrayList<>();

        for (String sessionId : sessions) {
            String sessionKey = WS_SESSION_PREFIX + sessionId;
            if (Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey))) {
                activeCount++;
            } else {
                expiredSessions.add(sessionId);
            }
        }

        if (!expiredSessions.isEmpty()) {
            redisTemplate.opsForSet().remove(userSessionsKey, expiredSessions.toArray());
        }

        return activeCount;
    }

    /**
     * Lấy danh sách active sessions của user
     * @param userId ID của user
     * @return Set các session IDs active
     */
    public Set<String> getActiveSessions(UUID userId) {
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;
        Set<String> sessions = redisTemplate.opsForSet().members(userSessionsKey);

        if (sessions == null || sessions.isEmpty()) {
            return new HashSet<>();
        }

        Set<String> activeSessions = new HashSet<>();
        List<String> expiredSessions = new ArrayList<>();

        for (String sessionId : sessions) {
            String sessionKey = WS_SESSION_PREFIX + sessionId;
            if (Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey))) {
                activeSessions.add(sessionId);
            } else {
                expiredSessions.add(sessionId);
            }
        }

        if (!expiredSessions.isEmpty()) {
            redisTemplate.opsForSet().remove(userSessionsKey, expiredSessions.toArray());
        }

        return activeSessions;
    }

    /**
     * Lấy thông tin chi tiết về session
     * @param sessionId Session ID
     * @return Map chứa thông tin session hoặc null nếu không tồn tại
     */
    public Map<String, String> getSessionInfo(String sessionId) {
        String sessionKey = WS_SESSION_PREFIX + sessionId;
        String sessionData = redisTemplate.opsForValue().get(sessionKey);

        if (sessionData == null) {
            return null;
        }

        Map<String, String> sessionInfo = new HashMap<>();
        String[] parts = sessionData.split(",");

        for (String part : parts) {
            String[] keyValue = part.split("=", 2);
            if (keyValue.length == 2) {
                sessionInfo.put(keyValue[0], keyValue[1]);
            }
        }

        return sessionInfo;
    }

    /**
     * Xóa tất cả kết nối của user (cleanup)
     * @param userId ID của user
     */
    public void clearAllConnections(UUID userId) {
        String userSessionsKey = WS_USER_SESSIONS_PREFIX + userId;
        Set<String> sessions = redisTemplate.opsForSet().members(userSessionsKey);

        if (sessions != null && !sessions.isEmpty()) {
            for (String sessionId : sessions) {
                String sessionKey = WS_SESSION_PREFIX + sessionId;
                redisTemplate.delete(sessionKey);
            }
        }

        redisTemplate.delete(userSessionsKey);

        log.info("Cleared all WebSocket connections for user: {}", userId);
    }

    /**
     * Cleanup expired sessions cho maintenance
     */
    public void cleanupExpiredSessions() {
        log.info("Starting cleanup of expired WebSocket sessions");

        String pattern = WS_USER_SESSIONS_PREFIX + "*";
        Set<String> userSessionKeys = new HashSet<>();
        try {
            redisTemplate.execute((RedisCallback<Void>) connection -> {
                Cursor<byte[]> cursor = connection.keyCommands().scan(
                        ScanOptions.scanOptions().match(pattern).count(100).build()
                );
                while (cursor.hasNext()) {
                    userSessionKeys.add(new String(cursor.next()));
                }
                return null;
            });
        } catch (Exception e) {
            log.error("Error scanning Redis for expired sessions: {}", e.getMessage(), e);
            return;
        }

        if (userSessionKeys.isEmpty()) {
            return;
        }

        int cleanedUsers = 0;
        int cleanedSessions = 0;

        for (String userSessionKey : userSessionKeys) {
            Set<String> sessions = redisTemplate.opsForSet().members(userSessionKey);

            if (sessions != null && !sessions.isEmpty()) {
                List<String> expiredSessions = new ArrayList<>();

                for (String sessionId : sessions) {
                    String sessionKey = WS_SESSION_PREFIX + sessionId;
                    if (!Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey))) {
                        expiredSessions.add(sessionId);
                        cleanedSessions++;
                    }
                }

                if (!expiredSessions.isEmpty()) {
                    redisTemplate.opsForSet().remove(userSessionKey, expiredSessions.toArray());
                }

                if (sessions.size() == expiredSessions.size()) {
                    redisTemplate.delete(userSessionKey);

                    cleanedUsers++;
                }
            }
        }

        log.info("Cleanup completed: {} users, {} sessions cleaned", cleanedUsers, cleanedSessions);
    }

    /**
     * Cập nhật device info cho session
     */
    public void updateDeviceInfo(UUID userId, String sessionId, String deviceInfo) {
        try {
            String sessionKey = WS_SESSION_PREFIX + sessionId;

            if (Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey))) {
                String sessionData = redisTemplate.opsForValue().get(sessionKey);
                if (sessionData != null) {
                    String[] parts = sessionData.split(",");
                    if (parts.length >= 2) {
                        String newSessionData = String.format("userId=%s,device=%s,timestamp=%s",
                                                            userId.toString(),
                                                            deviceInfo,
                                                            Instant.now().toEpochMilli());
                        redisTemplate.opsForValue().set(sessionKey, newSessionData, Duration.ofSeconds(SESSION_TTL));
                        log.debug("Updated device info for user: {}, session: {}, device: {}",
                                 userId, sessionId, deviceInfo);
                    }
                }
            } else {
                log.warn("Attempted to update device info for non-existent session: {} for user: {}",
                        sessionId, userId);
            }
        } catch (Exception e) {
            log.error("Error updating device info for user: {}, session: {}", userId, sessionId, e);
        }
    }

    public String getPrimaryDevice(UUID userId) {
        return getActiveSessions(userId).stream()
                .map(this::getSessionInfo)
                .filter(Objects::nonNull)
                .map(info -> info.get("device"))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }
}
