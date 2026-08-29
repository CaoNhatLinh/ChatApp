package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

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
    private static final String SESSION_KEY_PREFIX = KEY_PREFIX + "session:";
    private static final int MAX_TRACKED_USERS = 200;

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate messaging;
    private final SecurityContextHelper securityContext;
    private final ObjectMapper objectMapper;
    private final Duration ttl;
    private final String presenceChannel;
    private final Map<UUID, Set<PresenceSubscriber>> subscribersByTarget = new ConcurrentHashMap<>();
    private final Map<String, Set<UUID>> targetsBySession = new ConcurrentHashMap<>();
    private final Map<UUID, PresenceSnapshot> lastObservedByTarget = new ConcurrentHashMap<>();

    public PresenceService(
            StringRedisTemplate redis,
            SimpMessagingTemplate messaging,
            ObjectMapper objectMapper,
            SecurityContextHelper securityContext,
            @Value("${app.redis.presence-ttl:70s}") Duration ttl,
            @Value("${app.redis.presence-channel:chat:realtime:presence}") String presenceChannel) {
        this.redis = redis;
        this.messaging = messaging;
        this.objectMapper = objectMapper;
        this.securityContext = securityContext;
        if (ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("presence TTL must be positive");
        }
        this.ttl = ttl;
        if (presenceChannel == null || presenceChannel.isBlank()) {
            throw new IllegalArgumentException("presence channel must not be blank");
        }
        this.presenceChannel = presenceChannel;
    }

    public void subscribe(UUID actorId, String sessionId, PresenceSubscription command) {
        List<UUID> userIds = normalizeUserIds(command);
        String requiredSessionId = requireText(sessionId, "presence sessionId");
        Set<UUID> sessionTargets = targetsBySession.computeIfAbsent(
                requiredSessionId,
                ignored -> ConcurrentHashMap.newKeySet());
        long newTargetCount = userIds.stream().filter(userId -> !sessionTargets.contains(userId)).count();
        if (sessionTargets.size() + newTargetCount > MAX_TRACKED_USERS) {
            throw new BadRequestException("presence subscriptions exceed the maximum of " + MAX_TRACKED_USERS);
        }
        PresenceSubscriber subscriber = new PresenceSubscriber(actorId, requiredSessionId);
        for (UUID userId : userIds) {
            sessionTargets.add(userId);
            subscribersByTarget.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(subscriber);
            PresenceSnapshot snapshot = toPublicSnapshot(load(userId));
            lastObservedByTarget.put(userId, snapshot);
            sendToWatcher(actorId, snapshot);
        }
    }

    public void unsubscribe(UUID actorId, String sessionId, PresenceSubscription command) {
        String requiredSessionId = requireText(sessionId, "presence sessionId");
        PresenceSubscriber subscriber = new PresenceSubscriber(actorId, requiredSessionId);
        for (UUID userId : normalizeUserIds(command)) {
            removeSubscriber(userId, subscriber);
        }
    }

    @EventListener
    public void disconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        Set<UUID> targets = targetsBySession.remove(sessionId);
        if (targets != null) {
            for (UUID target : targets) {
                Set<PresenceSubscriber> subscribers = subscribersByTarget.get(target);
                if (subscribers == null) {
                    continue;
                }
                subscribers.removeIf(subscriber -> subscriber.sessionId().equals(sessionId));
                if (subscribers.isEmpty()) {
                    subscribersByTarget.remove(target, subscribers);
                    lastObservedByTarget.remove(target);
                }
            }
        }

        if (event.getUser() instanceof Authentication authentication) {
            UUID actorId = securityContext.getCurrentUserId(authentication);
            logout(actorId, sessionId);
        }
    }

    public void sendBatch(UUID actorId, PresenceSubscription command) {
        Map<String, PresenceSnapshot> snapshots = new LinkedHashMap<>();
        for (UUID userId : normalizeUserIds(command)) {
            snapshots.put(userId.toString(), toPublicSnapshot(load(userId)));
        }
        messaging.convertAndSendToUser(actorId.toString(), "/queue/presence-batch", snapshots);
    }

    public void heartbeat(UUID actorId, String sessionId, HeartbeatCommand command) {
        if (command == null) {
            throw new BadRequestException("heartbeat command is required");
        }
        String requiredSessionId = requireText(sessionId, "presence sessionId");
        PresenceSnapshot current = load(actorId);
        touchSession(actorId, requiredSessionId);
        String status = current.status() == null || current.status().isBlank() || "OFFLINE".equals(current.status())
                ? "ONLINE"
                : current.status();
        PresenceSnapshot next = newSnapshot(actorId, !"INVISIBLE".equals(status),
                status,
                command.deviceInfo(), current.lastSeen());
        save(next);
        publishIfChanged(current, next);
    }

    public void setStatus(UUID actorId, String sessionId, PresenceStatusCommand command) {
        if (command == null || command.status() == null || command.status().isBlank()) {
            throw new BadRequestException("presence status is required");
        }
        String requiredSessionId = requireText(sessionId, "presence sessionId");
        String status = command.status().trim().toUpperCase(java.util.Locale.ROOT);
        if (!Set.of("ONLINE", "AWAY", "DND", "INVISIBLE").contains(status)) {
            sendStatusError(actorId, "INVALID_STATUS", "Unsupported presence status", command);
            throw new BadRequestException("unsupported presence status");
        }

        PresenceSnapshot current = load(actorId);
        touchSession(actorId, requiredSessionId);
        boolean online = !"INVISIBLE".equals(status) && activeSessionCount(actorId) > 0;
        PresenceSnapshot next = newSnapshot(actorId, online, status, current.device(), current.lastSeen());
        save(next);
        messaging.convertAndSendToUser(actorId.toString(), "/queue/presence-sync",
                new PresenceSync("STATUS_SYNC", status,
                        command.requestId(), command.traceId(), null, null));
        publishIfChanged(current, next);
    }

    public void logout(UUID actorId, String sessionId) {
        String requiredSessionId = requireText(sessionId, "presence sessionId");
        removeSession(actorId, requiredSessionId);
        PresenceSnapshot current = load(actorId);
        boolean online = activeSessionCount(actorId) > 0 && !"INVISIBLE".equals(current.status());
        String status = online ? current.status() : "OFFLINE";
        String lastSeen = online ? current.lastSeen() : Instant.now().toString();
        PresenceSnapshot next = newSnapshot(actorId, online, status, current.device(), lastSeen);
        save(next);
        publishIfChanged(current, next);
    }

    private PresenceSnapshot load(UUID userId) {
        removeExpiredSessions(userId);
        String payload = redis.opsForValue().get(KEY_PREFIX + userId);
        if (payload != null) {
            try {
                PresenceSnapshot stored = objectMapper.readValue(payload, PresenceSnapshot.class);
                return withObservedOnlineState(userId, stored);
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

    private PresenceSnapshot withObservedOnlineState(UUID userId, PresenceSnapshot stored) {
        boolean hasActiveSession = activeSessionCount(userId) > 0;
        boolean online = hasActiveSession && !"INVISIBLE".equals(stored.status());
        String status = "INVISIBLE".equals(stored.status())
                ? "INVISIBLE"
                : hasActiveSession ? ("OFFLINE".equals(stored.status()) ? "ONLINE" : stored.status()) : "OFFLINE";
        return new PresenceSnapshot(stored.userId(), online, status, stored.timestamp(), stored.lastSeen(),
                stored.device(), online ? "just now" : stored.lastActiveAgo());
    }

    private void touchSession(UUID userId, String sessionId) {
        String key = sessionKey(userId);
        long expiresAt = Instant.now().plus(ttl).toEpochMilli();
        redis.opsForZSet().add(key, sessionId, expiresAt);
        redis.expire(key, ttl.multipliedBy(2));
    }

    private void removeSession(UUID userId, String sessionId) {
        redis.opsForZSet().remove(sessionKey(userId), sessionId);
    }

    private void removeExpiredSessions(UUID userId) {
        redis.opsForZSet().removeRangeByScore(sessionKey(userId), 0, Instant.now().toEpochMilli());
    }

    private long activeSessionCount(UUID userId) {
        removeExpiredSessions(userId);
        Long count = redis.opsForZSet().zCard(sessionKey(userId));
        return count == null ? 0 : count;
    }

    private String sessionKey(UUID userId) {
        return SESSION_KEY_PREFIX + userId;
    }

    private void publishIfChanged(PresenceSnapshot previous, PresenceSnapshot next) {
        PresenceSnapshot previousPublic = toPublicSnapshot(previous);
        PresenceSnapshot nextPublic = toPublicSnapshot(next);
        if (previousPublic.online() != nextPublic.online()
                || !java.util.Objects.equals(previousPublic.status(), nextPublic.status())) {
            publish(nextPublic);
        }
    }

    private PresenceSnapshot toPublicSnapshot(PresenceSnapshot snapshot) {
        if (!"INVISIBLE".equals(snapshot.status())) {
            return snapshot;
        }
        return newSnapshot(snapshot.userId(), false, "OFFLINE", snapshot.device(), snapshot.lastSeen());
    }

    private void publish(PresenceSnapshot snapshot) {
        try {
            redis.convertAndSend(presenceChannel, objectMapper.writeValueAsString(snapshot));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("could not serialize presence event", exception);
        }
    }

    public void forwardRedisPayload(String payload) {
        try {
            broadcastLocal(objectMapper.readValue(payload, PresenceSnapshot.class));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("invalid presence event payload", exception);
        }
    }

    private void broadcastLocal(PresenceSnapshot snapshot) {
        lastObservedByTarget.put(snapshot.userId(), snapshot);
        Set<PresenceSubscriber> subscribers = subscribersByTarget.getOrDefault(snapshot.userId(), Set.of());
        subscribers.stream()
                .map(PresenceSubscriber::actorId)
                .distinct()
                .forEach(watcher -> sendToWatcher(watcher, snapshot));
    }

    private void removeSubscriber(UUID target, PresenceSubscriber subscriber) {
        Set<UUID> sessionTargets = targetsBySession.get(subscriber.sessionId());
        if (sessionTargets != null) {
            sessionTargets.remove(target);
            if (sessionTargets.isEmpty()) {
                targetsBySession.remove(subscriber.sessionId(), sessionTargets);
            }
        }

        Set<PresenceSubscriber> subscribers = subscribersByTarget.get(target);
        if (subscribers != null) {
            subscribers.remove(subscriber);
            if (subscribers.isEmpty()) {
                subscribersByTarget.remove(target, subscribers);
                lastObservedByTarget.remove(target);
            }
        }
    }

    @Scheduled(fixedDelayString = "${app.redis.presence-sweep-ms:10000}")
    void sweepExpiredSessions() {
        for (UUID target : subscribersByTarget.keySet()) {
            PresenceSnapshot current = toPublicSnapshot(load(target));
            PresenceSnapshot previous = lastObservedByTarget.put(target, current);
            if (previous == null || previous.online() != current.online()
                    || !java.util.Objects.equals(previous.status(), current.status())) {
                broadcastLocal(current);
            }
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

    private record PresenceSubscriber(UUID actorId, String sessionId) {
    }
}
