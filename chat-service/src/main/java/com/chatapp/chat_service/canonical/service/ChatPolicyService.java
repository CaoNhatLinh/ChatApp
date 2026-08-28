package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.moderation.ModerationRepository;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ChatPolicyService {
    private static final DefaultRedisScript<Long> CLAIM_COOLDOWN = new DefaultRedisScript<>("""
            local claimed = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2])
            if claimed then return 0 end
            if redis.call('GET', KEYS[1]) == ARGV[1] then return 0 end
            return redis.call('PTTL', KEYS[1])
            """, Long.class);

    private final StringRedisTemplate redis;
    private final CanonicalCqlStore store;
    private final ModerationRepository moderation;

    @Autowired
    public ChatPolicyService(
            StringRedisTemplate redis,
            CanonicalCqlStore store,
            ModerationRepository moderation) {
        this.redis = redis;
        this.store = store;
        this.moderation = moderation;
    }

    public void enforceSend(
            CanonicalConversation conversation,
            CanonicalConversationMember member,
            Set<ConversationPermission> permissions,
            UUID requestId) {
        if (store.isConversationBanned(
                conversation.conversationId(), member.userId(), Instant.now())) {
            throw new ForbiddenException("member is banned from this conversation");
        }
        if (moderation.hasActiveAppSanction(member.userId(), Instant.now())) {
            throw new ForbiddenException("account has an active application sanction");
        }
        if (member.mutedUntil() != null && member.mutedUntil().isAfter(Instant.now())) {
            throw new ForbiddenException("member is muted until " + member.mutedUntil());
        }

        String chatMode = requireText(conversation.chatMode(), "conversation chatMode");
        if (!"OPEN".equalsIgnoreCase(chatMode) && !permissions.contains(ConversationPermission.ROOM_UPDATE)) {
            throw new ForbiddenException("conversation chat is restricted to room managers");
        }

        int intervalSeconds = member.messageIntervalSeconds() != null
                ? member.messageIntervalSeconds()
                : conversation.slowModeSeconds() == null ? 0 : conversation.slowModeSeconds();
        if (intervalSeconds <= 0) {
            return;
        }

        String key = "chat:send:cooldown:" + conversation.conversationId() + ":" + member.userId();
        Long remainingMillis = redis.execute(
                CLAIM_COOLDOWN,
                List.of(key),
                requestId.toString(),
                Long.toString(intervalSeconds * 1000L));
        if (remainingMillis != null && remainingMillis > 0) {
            long retryAfterSeconds = Math.max(1, (remainingMillis + 999L) / 1000L);
            throw new TooManyRequestsException("slow mode is active", retryAfterSeconds);
        }
    }

    private String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(field + " is missing");
        }
        return value;
    }
}
