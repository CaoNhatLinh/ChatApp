package com.chatapp.chat_service.redis.listener;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.presence.service.PresenceService;
import com.chatapp.chat_service.websocket.event.TypingEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisKeyExpirationListener implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserService userService;
    private final RedisTemplate<String, String> redisTemplate;
    private final PresenceService presenceService;
    private static final Pattern TYPING_KEY_PATTERN = Pattern
            .compile("conversation:typing:([a-f0-9-]{36}):([a-f0-9-]{36})");
    private static final Pattern SESSION_KEY_PATTERN = Pattern.compile("presence:hb:([a-f0-9-]{36}):(.+)");

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();
        log.debug("Redis key expired: {}", expiredKey);

        Matcher typingMatcher = TYPING_KEY_PATTERN.matcher(expiredKey);
        if (typingMatcher.matches()) {
            String conversationId = typingMatcher.group(1);
            UUID userId = UUID.fromString(typingMatcher.group(2));
            handleTypingKeyExpired(conversationId, userId);
            return;
        }

        Matcher sessionMatcher = SESSION_KEY_PATTERN.matcher(expiredKey);
        if (sessionMatcher.matches()) {
            UUID userId = UUID.fromString(sessionMatcher.group(1));
            String sessionId = sessionMatcher.group(2);
            presenceService.handleExpiredSession(userId, sessionId);
        }
    }

    private void handleTypingKeyExpired(String conversationId, UUID userId) {
        try {
            UUID conversationUuid = UUID.fromString(conversationId);

            UserDTO userInfo = userService.findById(userId)
                    .map(user -> UserDTO.builder()
                            .userId(user.getUserId())
                            .userName(user.getUsername())
                            .displayName(user.getDisplayName())
                            .nickName(user.getNickname())
                            .avatarUrl(user.getAvatarUrl())
                            .build())
                    .orElse(null);

            TypingEvent typingEvent = TypingEvent.builder()
                    .conversationId(conversationUuid)
                    .user(userInfo)
                    .typing(false)
                    .build();

            messagingTemplate.convertAndSend(
                    "/topic/conversation/" + conversationId + "/typing",
                    typingEvent);

        } catch (Exception e) {
            System.err.println(
                    "Error handling typing key expiration for conversation: " + conversationId + ", user: " + userId);
            e.printStackTrace();
        }
    }

}
