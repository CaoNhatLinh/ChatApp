package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
public class TypingService {
    private final ConversationAuthorizationService authorization;
    private final CanonicalCqlStore store;
    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate messaging;
    private final ObjectMapper objectMapper;
    private final Duration typingTtl;
    private final String typingChannel;

    public TypingService(
            ConversationAuthorizationService authorization,
            CanonicalCqlStore store,
            StringRedisTemplate redis,
            SimpMessagingTemplate messaging,
            ObjectMapper objectMapper,
            @Value("${app.redis.typing-ttl:8s}") Duration typingTtl,
            @Value("${app.redis.typing-channel:chat:realtime:typing}") String typingChannel) {
        this.authorization = authorization;
        this.store = store;
        this.redis = redis;
        this.messaging = messaging;
        this.objectMapper = objectMapper;
        if (typingTtl.isZero() || typingTtl.isNegative()) {
            throw new IllegalArgumentException("typing TTL must be positive");
        }
        this.typingTtl = typingTtl;
        this.typingChannel = typingChannel;
    }

    public void update(UUID actorId, TypingCommand command) {
        if (command == null || command.conversationId() == null) {
            throw new BadRequestException("typing conversationId is required");
        }
        authorization.requireMember(command.conversationId(), actorId);
        String key = "chat:typing:" + command.conversationId() + ":" + actorId;
        if (command.isTyping()) {
            redis.opsForValue().set(key, "1", typingTtl);
        } else {
            redis.delete(key);
        }
        CanonicalUser user = store.findUserById(actorId);
        if (user == null) {
            throw new IllegalStateException("authenticated user does not exist");
        }
        TypingEvent event = new TypingEvent(
                command.conversationId(),
                new TypingUser(actorId, user.username(), user.displayName(), user.avatarUrl()),
                command.isTyping());
        redis.convertAndSend(typingChannel, toJson(event));
    }

    public void forwardRedisPayload(String payload) {
        try {
            broadcast(objectMapper.readValue(payload, TypingEvent.class));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid typing event payload", exception);
        }
    }

    private void broadcast(TypingEvent event) {
        messaging.convertAndSend("/topic/conversation/" + event.conversationId() + "/typing", event);
    }

    private String toJson(TypingEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize typing event", exception);
        }
    }

    public record TypingCommand(UUID conversationId, boolean isTyping) {
    }

    public record TypingEvent(UUID conversationId, TypingUser user, boolean isTyping) {
    }

    public record TypingUser(UUID userId, String username, String displayName, String avatarUrl) {
    }
}
