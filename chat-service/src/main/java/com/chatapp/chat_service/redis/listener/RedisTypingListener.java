package com.chatapp.chat_service.redis.listener;

import com.chatapp.chat_service.websocket.event.TypingEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisTypingListener implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            Object event = redisTemplate.getValueSerializer().deserialize(message.getBody());
            
            if (event instanceof TypingEvent) {
                TypingEvent typingEvent = (TypingEvent) event;
                
                log.debug("Redis Pub/Sub received typing event for conv: {}, user: {}, isTyping: {}",
                        typingEvent.getConversationId(), 
                        typingEvent.getUser() != null ? typingEvent.getUser().getUserId() : "unknown",
                        typingEvent.isTyping());

                messagingTemplate.convertAndSend(
                        "/topic/conversation/" + typingEvent.getConversationId() + "/typing",
                        typingEvent
                );
            } else {
                log.warn("Received unexpected event type from Redis Pub/Sub: {}", event != null ? event.getClass().getName() : "null");
            }

        } catch (Exception e) {
            log.error("Failed to parse/broadcast typing event from Redis: {}", e.getMessage(), e);
        }
    }
}
