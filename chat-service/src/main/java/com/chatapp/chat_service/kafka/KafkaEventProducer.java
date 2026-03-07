package com.chatapp.chat_service.kafka;

import com.chatapp.chat_service.friendship.event.FriendRequestEvent;
import com.chatapp.chat_service.friendship.event.FriendshipStatusEvent;
import com.chatapp.chat_service.message.event.MessageEvent;
import com.chatapp.chat_service.message.event.MessageReactionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class KafkaEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String T_FRIEND_REQUEST = "friend-requests-topic";
    private static final String T_FRIENDSHIP_STATUS = "friendship-status-events";
    private static final String T_MESSAGE = "message-topic";
    private static final String T_MESSAGE_REACTION = "message-reaction-topic";
    private static final String T_MESSAGE_READ = "message-read-topic";
    private static final String T_MESSAGE_PIN = "message-pin-topic";
    private static final String T_MESSAGE_ATTACHMENT = "message-attachment-topic";
    private static final String T_NOTIFICATION = "notification-topic";

    
    public void sendFriendRequestEvent(UUID senderId, UUID receiverId) {
        kafkaTemplate.send(T_FRIEND_REQUEST, new FriendRequestEvent(senderId, receiverId));
    }

    public void sendFriendshipStatusEvent(FriendshipStatusEvent event) {
        kafkaTemplate.send(T_FRIENDSHIP_STATUS, event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.info("FriendshipStatusEvent sent successfully to Kafka");
                    } else {
                        log.error("Failed to send FriendshipStatusEvent: {}", ex.getMessage());
                    }
                });
    }


    public void sendMessageEvent(MessageEvent event) {
        log.info("Sending MessageEvent to Kafka: conversationId={}, senderId={}", 
                event.getConversationId(), event.getSenderId());
        String key = (event.getConversationId() != null) ? event.getConversationId().toString() : UUID.randomUUID().toString();
        kafkaTemplate.send(T_MESSAGE, key, event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.info("MessageEvent sent successfully to Kafka");
                    } else {
                        log.error("Failed to send MessageEvent to Kafka: {}", ex.getMessage());
                    }
                });
    }

    public void sendReactionEvent(MessageReactionEvent event) {
        String key = (event.getConversationId() != null) ? event.getConversationId().toString() : UUID.randomUUID().toString();
        kafkaTemplate.send(T_MESSAGE_REACTION, key, event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.info("MessageReactionEvent sent successfully to Kafka");
                    } else {
                        log.error("Failed to send MessageReactionEvent: {}", ex.getMessage());
                    }
                });
    }

    public void sendReadReceiptEvent(Object event) {
        kafkaTemplate.send(T_MESSAGE_READ, event)
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Failed to send ReadReceiptEvent: {}", ex.getMessage());
                });
    }

    public void sendPinEvent(Object event) {
        kafkaTemplate.send(T_MESSAGE_PIN, event);
    }

    public void sendAttachmentEvent(Object event) {
        kafkaTemplate.send(T_MESSAGE_ATTACHMENT, event);
    }

    
    public void sendNotificationEvent(Object event) {
        kafkaTemplate.send(T_NOTIFICATION, event);
    }
}