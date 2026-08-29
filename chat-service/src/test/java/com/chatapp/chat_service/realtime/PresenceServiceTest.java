package com.chatapp.chat_service.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.CloseStatus;
import com.chatapp.chat_service.security.core.SecurityContextHelper;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PresenceServiceTest {
    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private ZSetOperations<String, String> sessions;
    private SimpMessagingTemplate messaging;
    private SecurityContextHelper securityContext;
    private PresenceService service;
    private UUID actor;
    private UUID target;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        sessions = mock(ZSetOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(redis.opsForZSet()).thenReturn(sessions);
        messaging = mock(SimpMessagingTemplate.class);
        securityContext = mock(SecurityContextHelper.class);
        service = new PresenceService(redis, messaging, new ObjectMapper(), securityContext,
                Duration.ofSeconds(70), "presence-events");
        actor = UUID.randomUUID();
        target = UUID.randomUUID();
    }

    @Test
    void sessionDisconnectRemovesOnlyTheDisconnectedSession() {
        service.subscribe(actor, "session-a", subscription(target));
        service.subscribe(actor, "session-b", subscription(target));

        clearInvocations(messaging);
        service.disconnect(new SessionDisconnectEvent(
                this,
                MessageBuilder.withPayload(new byte[0]).build(),
                "session-a",
                CloseStatus.NORMAL));
        service.forwardRedisPayload(snapshotJson(true));

        verify(messaging).convertAndSendToUser(eq(actor.toString()), eq("/queue/presence"), any());
    }

    @Test
    void redisPresenceEventsReachLocalSubscribersOncePerAccount() {
        service.subscribe(actor, "session-a", subscription(target));
        service.subscribe(actor, "session-b", subscription(target));

        clearInvocations(messaging);
        service.forwardRedisPayload(snapshotJson(true));

        verify(messaging).convertAndSendToUser(eq(actor.toString()), eq("/queue/presence"), any());
    }

    @Test
    void heartbeatPublishesAnEventForOtherNodes() {
        when(values.get(anyString())).thenReturn(null);

        service.heartbeat(actor, "session-a",
                new PresenceService.HeartbeatCommand("Desktop", "request", "trace"));

        verify(redis).convertAndSend(eq("presence-events"), anyString());
    }

    @Test
    void sweepEmitsOfflineWhenTheLastSessionExpires() {
        service.subscribe(actor, "session-a", subscription(target));
        service.forwardRedisPayload(snapshotJson(true));
        clearInvocations(messaging);

        service.sweepExpiredSessions();

        verify(messaging).convertAndSendToUser(eq(actor.toString()), eq("/queue/presence"), any());
    }

    private PresenceService.PresenceSubscription subscription(UUID userId) {
        return new PresenceService.PresenceSubscription(List.of(userId), "request", "trace");
    }

    private String snapshotJson(boolean online) {
        return "{\"userId\":\"" + target + "\",\"online\":" + online
                + ",\"status\":\"" + (online ? "ONLINE" : "OFFLINE") + "\""
                + ",\"timestamp\":\"2026-08-29T00:00:00Z\",\"lastSeen\":null,\"device\":null,\"lastActiveAgo\":\"just now\"}";
    }
}
