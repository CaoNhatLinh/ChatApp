package com.chatapp.chat_service.presence.service;

import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.presence.dto.UserPresenceResponse;
import com.chatapp.chat_service.presence.event.OnlineStatusEvent;
import com.chatapp.chat_service.websocket.service.WebSocketConnectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * PresenceService - Manages user online/offline status using Redis.
 *
 * Architecture:
 * 1. Redis-only (no Kafka) — presence is ephemeral, direct STOMP broadcast is faster.
 * 2. Multi-device via session sets — each device/tab has its own session.
 * 3. Heartbeat TTL 45s — client sends every 30s, 15s grace period.
 * 4. Custom status — ONLINE, DND (Do Not Disturb), INVISIBLE.
 * 5. Targeted broadcast — status changes sent only to watchers, not all users.
 * 6. Pull-on-reconnect — user requests batch presence on connect.
 * 7. Persistence — status_preference saved to Cassandra, restored on reconnect.
 * 8. Rate limiting — max 5 status changes per 30 seconds via Redis atomic counter.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private final RedisTemplate<String, String> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final WebSocketConnectionService webSocketConnectionService;


    private static final String USER_SESSIONS_KEY = "presence:sessions:%s";
    private static final String SESSION_HEARTBEAT_KEY = "presence:hb:%s:%s";
    private static final String LAST_ACTIVE_KEY = "presence:last_active:%s";
    private static final String CUSTOM_STATUS_KEY = "presence:custom_status:%s";
    private static final String MY_SUBSCRIPTIONS_KEY = "presence:subs:%s";
    private static final String MY_WATCHERS_KEY = "presence:watchers:%s";

    private static final long HEARTBEAT_TTL_SECONDS = 45;

    private static final Set<String> ALLOWED_STATUSES = Set.of("ONLINE", "DND", "INVISIBLE");

    private static final String RATE_LIMIT_KEY = "presence:rate_limit:%s";
    private static final int RATE_LIMIT_MAX = 5;
    private static final int RATE_LIMIT_WINDOW_SECONDS = 30;

    private static final String USERNAME_CACHE_KEY = "presence:username:%s";


    /**
     * Called when a WebSocket STOMP session connects (from WebSocketConnectHandler).
     */
    public void handleConnection(UUID userId, String sessionId) {
        log.info("User {} connected with session {}", userId, sessionId);
        String sessionsKey = String.format(USER_SESSIONS_KEY, userId);

        setHeartbeat(userId, sessionId);

        redisTemplate.opsForSet().add(sessionsKey, sessionId);

        String usernameKey = String.format(USERNAME_CACHE_KEY, userId);
        boolean usernameAlreadyCached = Boolean.TRUE.equals(redisTemplate.hasKey(usernameKey));
        String restoredStatusPref = null;

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (!usernameAlreadyCached && user.getUsername() != null) {
                redisTemplate.opsForValue().set(usernameKey, user.getUsername(), Duration.ofDays(30));
            }
            String pref = user.getStatusPreference();
            if (pref != null && !pref.isEmpty() && !"ONLINE".equals(pref)) {
                restoredStatusPref = pref;
            }
        }

        Set<String> allSessionIds = redisTemplate.opsForSet().members(sessionsKey);
        boolean otherActiveSessionFound = false;

        if (allSessionIds != null) {
            for (String sid : allSessionIds) {
                if (sid.equals(sessionId)) continue; 

                String hbKey = String.format(SESSION_HEARTBEAT_KEY, userId, sid);
                if (Boolean.TRUE.equals(redisTemplate.hasKey(hbKey))) {
                    otherActiveSessionFound = true;
                } else {
                    redisTemplate.opsForSet().remove(sessionsKey, sid);
                    log.debug("Cleaned up stale ghost session {} for user {}", sid, userId);
                }
            }
        }

        if (!otherActiveSessionFound) {
            log.info("User {} is now ONLINE (first valid session)", userId);

            if (restoredStatusPref != null) {
                String customStatusKey = String.format(CUSTOM_STATUS_KEY, userId);
                redisTemplate.opsForValue().set(customStatusKey, restoredStatusPref);
                log.info("User {} restored status preference: {}", userId, restoredStatusPref);
            }

            broadcastStatusToWatchers(userId, true);
        }
    }

    /**
     * Called every 30s by the client heartbeat.
     */
    public void handleHeartbeat(UUID userId, String sessionId) {
        log.debug("Heartbeat received for user {}, session {}", userId, sessionId);
        setHeartbeat(userId, sessionId);
    }

    /**
     * Called when heartbeat key expires in Redis (dirty disconnect).
     */
    public void handleExpiredSession(UUID userId, String sessionId) {
        log.warn("Heartbeat expired for user {}, session {}", userId, sessionId);
        removeSession(userId, sessionId);
    }

    /**
     * Called on clean WebSocket disconnect (SessionDisconnectEvent).
     */
    public void handleDisconnect(UUID userId, String sessionId) {
        log.info("User {} disconnected from session {}", userId, sessionId);
        String heartbeatKey = String.format(SESSION_HEARTBEAT_KEY, userId, sessionId);
        redisTemplate.delete(heartbeatKey);
        removeSession(userId, sessionId);
    }

    private void removeSession(UUID userId, String sessionId) {
        String sessionsKey = String.format(USER_SESSIONS_KEY, userId);

        String luaScript = "redis.call('SREM', KEYS[1], ARGV[1]); return redis.call('SCARD', KEYS[1])";
        Long remaining = redisTemplate.execute(
                new org.springframework.data.redis.core.script.DefaultRedisScript<>(luaScript, Long.class),
                List.of(sessionsKey),
                sessionId
        );

        if (remaining == null || remaining == 0) {
            log.info("User {} is now OFFLINE (no remaining sessions)", userId);
            storeLastActive(userId);
            redisTemplate.delete(String.format(CUSTOM_STATUS_KEY, userId));
            broadcastStatusToWatchers(userId, false);
            cleanupAllSubscriptions(userId);
        }
    }

    private void setHeartbeat(UUID userId, String sessionId) {
        String heartbeatKey = String.format(SESSION_HEARTBEAT_KEY, userId, sessionId);
        redisTemplate.opsForValue().set(heartbeatKey, "1", Duration.ofSeconds(HEARTBEAT_TTL_SECONDS));
    }


    /**
     * Set custom status for the user.
     * Supported: ONLINE, DND, INVISIBLE.
     * - DND: visible to others as DND (red icon), notifications suppressed.
     * - INVISIBLE: appears offline to others, but user can still use all features.
     * Status is persisted to Cassandra for cross-session survival.
     */
    public void setCustomStatus(UUID userId, String status) {
        String normalizedStatus = status.toUpperCase();
        if (!ALLOWED_STATUSES.contains(normalizedStatus)) {
            log.warn("Invalid status '{}' for user {}. Allowed: {}", status, userId, ALLOWED_STATUSES);
            return;
        }

        String rateLimitKey = String.format(RATE_LIMIT_KEY, userId);
        Long count = redisTemplate.opsForValue().increment(rateLimitKey);
        if (count != null && count == 1L) {
            redisTemplate.expire(rateLimitKey, Duration.ofSeconds(RATE_LIMIT_WINDOW_SECONDS));
        }
        if (count != null && count > RATE_LIMIT_MAX) {
            log.warn("Rate limit exceeded for user {} ({}/{})", userId, count, RATE_LIMIT_MAX);
            Map<String, Object> errorEvent = Map.of(
                "type", "RATE_LIMIT_ERROR",
                "message", "Too many status changes. Please wait before trying again.",
                "retryAfterSeconds", RATE_LIMIT_WINDOW_SECONDS
            );
            messagingTemplate.convertAndSendToUser(userId.toString(), "/queue/presence-sync", errorEvent);
            return;
        }

        String customStatusKey = String.format(CUSTOM_STATUS_KEY, userId);
        if ("ONLINE".equals(normalizedStatus)) {
            redisTemplate.delete(customStatusKey);
        } else {
            redisTemplate.opsForValue().set(customStatusKey, normalizedStatus);
        }

        userRepository.findById(userId).ifPresent(user -> {
            user.setStatusPreference(normalizedStatus);
            user.setStatusUpdatedAt(Instant.now());
            userRepository.save(user);
        });

        log.info("User {} set status to {}", userId, normalizedStatus);

        boolean isOnline = isUserOnline(userId);
        if ("INVISIBLE".equals(normalizedStatus)) {
            broadcastStatusToWatchers(userId, false, "OFFLINE");
        } else if (isOnline) {
            broadcastStatusToWatchers(userId, true, normalizedStatus);
        }

        notifyOwnDevices(userId, normalizedStatus);
    }

    /**
     * Get effective status of a user.
     * Returns the actual custom status (ONLINE, DND, INVISIBLE) or OFFLINE.
     */
    public String getUserStatus(UUID userId) {
        if (!isUserOnline(userId)) {
            return "OFFLINE";
        }
        String customStatusKey = String.format(CUSTOM_STATUS_KEY, userId);
        String customStatus = redisTemplate.opsForValue().get(customStatusKey);
        return customStatus != null ? customStatus : "ONLINE";
    }

    /**
     * Get the status that should be visible to OTHER users.
     * INVISIBLE users appear as OFFLINE.
     * DND users appear as DND (red icon).
     */
    public String getPublicStatus(UUID userId) {
        String actual = getUserStatus(userId);
        if ("INVISIBLE".equals(actual)) {
            return "OFFLINE";
        }
        return actual;
    }

    /**
     * Notify all devices of the same user about a status change.
     * Uses a Redis cache for username lookup to avoid extra Cassandra queries.
     * Cache key: presence:username:{userId} — populated on connect.
     * Used for multi-device synchronization (Last Writer Wins).
     */
    private void notifyOwnDevices(UUID userId, String status) {
        Map<String, Object> syncEvent = Map.of(
            "type", "STATUS_SYNC",
            "status", status,
            "timestamp", Instant.now().toString()
        );
        messagingTemplate.convertAndSendToUser(
            userId.toString(), "/queue/presence-sync", syncEvent
        );
        String cachedUsername = redisTemplate.opsForValue().get(
            String.format(USERNAME_CACHE_KEY, userId));
        if (cachedUsername != null && !cachedUsername.equals(userId.toString())) {
            messagingTemplate.convertAndSendToUser(
                cachedUsername, "/queue/presence-sync", syncEvent
            );
        }
    }


    /**
     * Check if a user is effectively online (has at least one session with active heartbeat).
     */
    public boolean isUserOnline(UUID userId) {
        String sessionsKey = String.format(USER_SESSIONS_KEY, userId);
        Set<String> sessionIds = redisTemplate.opsForSet().members(sessionsKey);
        if (sessionIds == null || sessionIds.isEmpty()) return false;

        for (String sid : sessionIds) {
            if (redisTemplate.hasKey(String.format(SESSION_HEARTBEAT_KEY, userId, sid))) {
                return true;
            }
        }
        return false;
    }


    /**
     * Add users to the watch list. Incremental — only adds new entries,
     * does NOT remove existing subscriptions (client ref-counts locally).
     */
    public void addSubscriptions(UUID subscriberId, List<UUID> targetUserIds) {
        if (CollectionUtils.isEmpty(targetUserIds)) return;

        String mySubsKey = String.format(MY_SUBSCRIPTIONS_KEY, subscriberId);
        String subscriberIdStr = subscriberId.toString();

        for (UUID targetId : targetUserIds) {
            String theirWatchersKey = String.format(MY_WATCHERS_KEY, targetId);
            redisTemplate.opsForSet().add(theirWatchersKey, subscriberIdStr);
            redisTemplate.opsForSet().add(mySubsKey, targetId.toString());
        }
        log.debug("User {} added {} subscriptions", subscriberId, targetUserIds.size());
    }

    /**
     * Remove specific users from the watch list.
     * Called when the client no longer has any component viewing these users.
     */
    public void removeSubscriptions(UUID subscriberId, List<UUID> targetUserIds) {
        if (CollectionUtils.isEmpty(targetUserIds)) return;

        String mySubsKey = String.format(MY_SUBSCRIPTIONS_KEY, subscriberId);
        String subscriberIdStr = subscriberId.toString();

        for (UUID targetId : targetUserIds) {
            String theirWatchersKey = String.format(MY_WATCHERS_KEY, targetId);
            redisTemplate.opsForSet().remove(theirWatchersKey, subscriberIdStr);
            redisTemplate.opsForSet().remove(mySubsKey, targetId.toString());
        }
        log.debug("User {} removed {} subscriptions", subscriberId, targetUserIds.size());
    }

    /**
     * Clean up ALL subscriptions for a user (on full disconnect).
     * Removes this user from every watched user's watcher set, then deletes own subs set.
     */
    public void cleanupAllSubscriptions(UUID userId) {
        String mySubsKey = String.format(MY_SUBSCRIPTIONS_KEY, userId);
        Set<String> subscribedToIds = redisTemplate.opsForSet().members(mySubsKey);

        if (subscribedToIds != null && !subscribedToIds.isEmpty()) {
            String userIdStr = userId.toString();
            for (String targetId : subscribedToIds) {
                String theirWatchersKey = String.format(MY_WATCHERS_KEY, targetId);
                redisTemplate.opsForSet().remove(theirWatchersKey, userIdStr);
            }
            redisTemplate.delete(mySubsKey);
            log.debug("Cleaned up {} subscriptions for user {}", subscribedToIds.size(), userId);
        }
    }

    public Set<UUID> getWatchers(UUID userId) {
        String watchersKey = String.format(MY_WATCHERS_KEY, userId);
        Set<String> watcherIdsStr = redisTemplate.opsForSet().members(watchersKey);
        if (watcherIdsStr == null) return Collections.emptySet();

        return watcherIdsStr.stream()
                .map(UUID::fromString)
                .collect(Collectors.toSet());
    }


    /**
     * Get presence for multiple users using RedisTemplate (non-deprecated).
     * Core of "pull-on-reconnect": user calls this on connect to get contact statuses.
     */
    public Map<UUID, UserPresenceResponse> getBatchPresence(List<UUID> userIds) {
        if (CollectionUtils.isEmpty(userIds)) {
            return Collections.emptyMap();
        }

        Map<UUID, UserPresenceResponse> resultMap = new HashMap<>();

        try {
            Map<UUID, Boolean> onlineStatusMap = new HashMap<>();
            Map<UUID, String> customStatuses = new HashMap<>();

            for (UUID userId : userIds) {
                boolean online = isUserOnline(userId);
                onlineStatusMap.put(userId, online);

                String customStatusKey = String.format(CUSTOM_STATUS_KEY, userId);
                String cs = redisTemplate.opsForValue().get(customStatusKey);
                if (cs != null) customStatuses.put(userId, cs);
            }

            for (UUID userId : userIds) {
                boolean isOnline = onlineStatusMap.getOrDefault(userId, false);
                String customStatus = customStatuses.get(userId);

                String status = "OFFLINE";
                Instant lastActive = null;

                if ("INVISIBLE".equals(customStatus)) {
                    isOnline = false;
                    status = "OFFLINE";
                    lastActive = getLastActive(userId);
                } else if (isOnline) {
                    status = customStatus != null ? customStatus : "ONLINE";
                } else {
                    lastActive = getLastActive(userId);
                }

                resultMap.put(userId, UserPresenceResponse.builder()
                        .userId(userId)
                        .isOnline(isOnline)
                        .status(status)
                    .device(isOnline ? webSocketConnectionService.getPrimaryDevice(userId) : null)
                        .lastSeen(lastActive)
                        .lastActiveAgo(UserPresenceResponse.formatLastActive(lastActive))
                        .build());
            }
        } catch (Exception e) {
            log.error("Error getting batch presence", e);
        }

        return resultMap;
    }


    /**
     * Broadcast status change only to online watchers of this user.
     */
    private void broadcastStatusToWatchers(UUID userId, boolean isOnline) {
        String status = "OFFLINE";
        if (isOnline) {
            String customStatusKey = String.format(CUSTOM_STATUS_KEY, userId);
            String customStatus = redisTemplate.opsForValue().get(customStatusKey);
            if ("INVISIBLE".equals(customStatus)) {
                isOnline = false;
                status = "OFFLINE";
            } else {
                status = (customStatus != null) ? customStatus : "ONLINE";
            }
        }
        
        broadcastStatusToWatchers(userId, isOnline, status);
    }

    @Async
    public void broadcastStatusToWatchers(UUID userId, boolean isOnline, String status) {

        Set<UUID> watchers = getWatchers(userId);
        log.info("Broadcasting status {} for user {} to {} watchers", status, userId, watchers.size());
        if (watchers.isEmpty()) {
            log.debug("No watchers for user {}, skipping broadcast", userId);
            return;
        }


        OnlineStatusEvent event = OnlineStatusEvent.builder()
                .userId(userId)
                .online(isOnline)
                .status(status)
            .device(isOnline ? webSocketConnectionService.getPrimaryDevice(userId) : null)
                .timestamp(Instant.now())
                .build();

        int sent = 0;
        for (UUID watcherId : watchers) {
            messagingTemplate.convertAndSendToUser(
                    watcherId.toString(),
                    "/queue/presence",
                    event
            );
            sent++;

            String watcherUsernameKey = String.format(USERNAME_CACHE_KEY, watcherId);
            String watcherUsername = redisTemplate.opsForValue().get(watcherUsernameKey);
            if (watcherUsername != null && !watcherUsername.equals(watcherId.toString())) {
                messagingTemplate.convertAndSendToUser(
                        watcherUsername,
                        "/queue/presence",
                        event
                );
            }
        }

        log.info("Broadcast {} status ({}) to {} watchers", userId, status, sent);
    }


    private void storeLastActive(UUID userId) {
        String lastActiveKey = String.format(LAST_ACTIVE_KEY, userId);
        redisTemplate.opsForValue().set(lastActiveKey, Instant.now().toString(), Duration.ofDays(30));
    }

    private Instant getLastActive(UUID userId) {
        String lastActiveKey = String.format(LAST_ACTIVE_KEY, userId);
        String lastActiveStr = redisTemplate.opsForValue().get(lastActiveKey);
        if (lastActiveStr != null) {
            try {
                return Instant.parse(lastActiveStr);
            } catch (Exception e) {
                log.warn("Failed to parse last active time for user {}", userId);
            }
        }
        return null;
    }

    private Set<String> scanKeys(String pattern) {
        Set<String> keys = new HashSet<>();
        try {
            redisTemplate.execute((RedisCallback<Void>) connection -> {
                var cursor = connection.keyCommands().scan(
                        ScanOptions.scanOptions().match(pattern).count(100).build()
                );
                while (cursor.hasNext()) {
                    keys.add(new String(cursor.next(), java.nio.charset.StandardCharsets.UTF_8));
                }
                return null;
            });
        } catch (Exception e) {
            log.error("Error scanning Redis for pattern '{}': {}", pattern, e.getMessage(), e);
        }
        return keys;
    }
}