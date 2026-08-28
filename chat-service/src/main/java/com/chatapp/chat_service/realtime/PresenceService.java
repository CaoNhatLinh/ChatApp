package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Owns the ephemeral presence contract used by the web client. Redis is the
 * canonical shared store for this state.
 */
@Service
public class PresenceService {
    private static final String KEY_PREFIX = "chat:presence:";
    private static final int MAX_TRACKED_USERS = 200;

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate messaging;
    private final ObjectMapper objectMapper;
    private final Duration ttl;
    private final Map<UUID, Set<UUID>> watchersByTarget = new ConcurrentHashMap<>();

    public PresenceService(
            StringRedisTemplate redis,
            SimpMessagingTemplate messaging,
            ObjectMapper objectMapper,
            @Value("${app.redis.presence-ttl:70s}") Duration ttl) {
        this.redis = redis;
        this.messaging = messaging;
        this.objectMapper = objectMapper;
        if (ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("presence TTL must be positive");
        }
        this.ttl = ttl;
    }

    public void subscribe(UUID actorId, PresenceSubscription command) {
        List<UUID> userIds = normalizeUserIds(command);
        for (UUID userId : userIds) {
            watchersByTarget.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(actorId);
            sendToWatcher(actorId, load(userId));
        }
    }

    public void unsubscribe(UUID actorId, PresenceSubscription command) {
        for (UUID userId : normalizeUserIds(command)) {
            Set<UUID> watchers = watchersByTarget.get(userId);
            if (watchers == null) {
                continue;
            }
            watchers.remove(actorId);
            if (watchers.isEmpty()) {
                watchersByTarget.remove(userId, watchers);
            }
        }
    }

    public void sendBatch(UUID actorId, PresenceSubscription command) {
        Map<String, PresenceSnapshot> snapshots = new LinkedHashMap<>();
        for (UUID userId : normalizeUserIds(command)) {
            snapshots.put(userId.toString(), load(userId));
        }
        messaging.convertAndSendToUser(actorId.toString(), "/queue/presence-batch", snapshots);
    }

    public void heartbeat(UUID actorId, HeartbeatCommand command) {
        if (command == null) {
            throw new BadRequestException("heartbeat command is required");
        }
        PresenceSnapshot current = load(actorId);
        PresenceSnapshot next = newSnapshot(actorId, true,
                requireText(current.status(), "stored presence status"),
                command.deviceInfo(), current.lastSeen());
        save(next);
        broadcast(next);
    }

    public void setStatus(UUID actorId, PresenceStatusCommand command) {
        if (command == null || command.status() == null || command.status().isBlank()) {
            throw new BadRequestException("presence status is required");
        }
        String status = command.status().trim().toUpperCase(java.util.Locale.ROOT);
        if (!Set.of("ONLINE", "AWAY", "DND", "INVISIBLE").contains(status)) {
            sendStatusError(actorId, "INVALID_STATUS", "Unsupported presence status", command);
            throw new BadRequestException("unsupported presence status");
        }

        PresenceSnapshot current = load(actorId);
        boolean online = !"INVISIBLE".equals(status);
        PresenceSnapshot next = newSnapshot(actorId, online, status, current.device(), current.lastSeen());
        save(next);
        messaging.convertAndSendToUser(actorId.toString(), "/queue/presence-sync",
                new PresenceSync("STATUS_SYNC", status,
                        command.requestId(), command.traceId(), null, null));
        broadcast(next);
    }

    public void logout(UUID actorId) {
        PresenceSnapshot current = load(actorId);
        PresenceSnapshot offline = newSnapshot(actorId, false, "OFFLINE", current.device(), Instant.now().toString());
        remove(actorId);
        broadcast(offline);
    }

    private PresenceSnapshot load(UUID userId) {
        String payload = redis.opsForValue().get(KEY_PREFIX + userId);
        if (payload != null) {
            try {
                return objectMapper.readValue(payload, PresenceSnapshot.class);
            } catch (Exception exception) {
                throw new IllegalStateException("stored presence payload is invalid", exception);
            }
        }
        return newSnapshot(userId, false, "OFFLINE", null, null);
    }

    private void save(PresenceSnapshot snapshot) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("could not serialize presence snapshot", exception);
        }
        redis.opsForValue().set(KEY_PREFIX + snapshot.userId(), payload, ttl);
    }

    private void remove(UUID userId) {
        redis.delete(KEY_PREFIX + userId);
    }

    private void broadcast(PresenceSnapshot snapshot) {
        Set<UUID> watchers = watchersByTarget.getOrDefault(snapshot.userId(), Set.of());
        for (UUID watcher : watchers) {
            sendToWatcher(watcher, snapshot);
        }
    }

    private void sendToWatcher(UUID watcher, PresenceSnapshot snapshot) {
        messaging.convertAndSendToUser(watcher.toString(), "/queue/presence", snapshot);
    }

    private void sendStatusError(UUID actorId, String errorType, String message, PresenceStatusCommand command) {
        messaging.convertAndSendToUser(actorId.toString(), "/queue/presence-sync",
                new PresenceSync("STATUS_SYNC_ERROR", null,
                        command.requestId(), command.traceId(), errorType, message));
    }

    private List<UUID> normalizeUserIds(PresenceSubscription command) {
        if (command == null || command.userIds() == null || command.userIds().isEmpty()) {
            throw new BadRequestException("presence userIds are required");
        }
        if (command.userIds().size() > MAX_TRACKED_USERS) {
            throw new BadRequestException("presence userIds exceed the maximum of " + MAX_TRACKED_USERS);
        }
        Set<UUID> unique = ConcurrentHashMap.newKeySet();
        for (UUID userId : command.userIds()) {
            if (userId == null || !unique.add(userId)) {
                throw new BadRequestException("presence userIds must be unique and non-null");
            }
        }
        return List.copyOf(command.userIds());
    }

    private String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(field + " is missing");
        }
        return value;
    }

    private PresenceSnapshot newSnapshot(UUID userId, boolean online, String status, String device, String lastSeen) {
        String timestamp = Instant.now().toString();
        return new PresenceSnapshot(userId, online, status, timestamp, lastSeen, device,
                online ? "just now" : "offline");
    }

    public record PresenceSubscription(List<UUID> userIds, String requestId, String traceId) {
    }

    public record HeartbeatCommand(String deviceInfo, String requestId, String traceId) {
    }

    public record PresenceStatusCommand(String status, String requestId, String traceId) {
    }

    public record PresenceSnapshot(
            UUID userId,
            boolean online,
            String status,
            String timestamp,
            String lastSeen,
            String device,
            String lastActiveAgo) {
    }

    public record PresenceSync(
            String type,
            String status,
            String requestId,
            String traceId,
            String errorType,
            String message) {
    }
}
