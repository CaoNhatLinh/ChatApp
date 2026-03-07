package com.chatapp.chat_service.websocket.interceptor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Rate limiter for WebSocket messages to prevent spam and resource exhaustion.
 * Allows max 30 SEND messages per 10-second sliding window per user.
 */
@Component
@Slf4j
public class WebSocketRateLimitInterceptor implements ChannelInterceptor {

    private static final int MAX_MESSAGES_PER_WINDOW = 30;
    private static final long WINDOW_MS = 10_000L; 

    private final ConcurrentHashMap<String, UserRateLimit> rateLimits = new ConcurrentHashMap<>();

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null || accessor.getCommand() != StompCommand.SEND) {
            return message; 
        }

        Principal user = accessor.getUser();
        if (user == null) {
            return message;
        }

        String userId = user.getName();
        UserRateLimit rateLimit = rateLimits.computeIfAbsent(userId, k -> new UserRateLimit());

        if (!rateLimit.tryAcquire()) {
            log.warn("[RateLimit] User {} exceeded message rate limit ({} msgs/{}s). Message dropped.",
                    userId, MAX_MESSAGES_PER_WINDOW, WINDOW_MS / 1000);
            return null; 
        }

        return message;
    }

    /**
     * Cleanup rate limit entries for disconnected users.
     * Called periodically or on DISCONNECT event.
     */
    public void cleanupUser(String userId) {
        rateLimits.remove(userId);
    }

    /**
     * Sliding window rate limiter per user.
     */
    private static class UserRateLimit {
        private final AtomicInteger count = new AtomicInteger(0);
        private final AtomicLong windowStart = new AtomicLong(System.currentTimeMillis());

        boolean tryAcquire() {
            long now = System.currentTimeMillis();
            long start = windowStart.get();

            if (now - start > WINDOW_MS) {
                windowStart.set(now);
                count.set(1);
                return true;
            }

            return count.incrementAndGet() <= MAX_MESSAGES_PER_WINDOW;
        }
    }
}
