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
    private static final String T_CONVERSATION_MANAGEMENT = "conversation-management-topic";
    private static final String T_NOTIFICATION = "notification-topic";
    private static final String T_CONVERSATION_LIST_UPDATE = "conversation-list-update-topic";

    
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

    public void sendConversationManagementEvent(com.chatapp.chat_service.conversation.event.ConversationManagementEvent event) {
        String key = event.getConversationId().toString();
        kafkaTemplate.send(T_CONVERSATION_MANAGEMENT, key, event);
    }

    
    public void sendNotificationEvent(Object event) {
        kafkaTemplate.send(T_NOTIFICATION, event);
    }

    public void publishConversationListUpdateEvent(UUID userId, UUID conversationId, java.time.Instant activityTime, boolean isPinned) {
        try {
            java.util.Map<String, Object> event = java.util.Map.of(
                    "userId", userId,
                    "conversationId", conversationId,
                    "activityTime", activityTime,
                    "isPinned", isPinned,
                    "eventType", "CONVERSATION_LIST_UPDATE"
            );
            String key = userId.toString();
            kafkaTemplate.send(T_CONVERSATION_LIST_UPDATE, key, event)
                    .whenComplete((result, ex) -> {
                        if (ex == null) {
                            log.info("ConversationListUpdateEvent sent successfully for user {}", userId);
                        } else {
                            log.error("Failed to send ConversationListUpdateEvent for user {}: {}", userId, ex.getMessage());
                        }
                    });
        } catch (Exception e) {
            log.error("Failed to publish conversation list update event: {}", e.getMessage());
        }
    }

    public void publishMessageReactionEvent(com.chatapp.chat_service.message.event.MessageReactionEvent event) {
        sendReactionEvent(event);
    }

    public void publishMessageReadEvent(com.chatapp.chat_service.message.event.MessageReadEvent event) {
        sendReadReceiptEvent(event);
    }

    public void publishUserBlockEvent(UUID blockerId, UUID blockedUserId, String action) {
        try {
            java.util.Map<String, Object> event = java.util.Map.of(
                    "blockerId", blockerId,
                    "blockedUserId", blockedUserId,
                    "action", action,
                    "eventType", "USER_BLOCK"
            );
            kafkaTemplate.send(T_CONVERSATION_MANAGEMENT, blockerId.toString(), event);
        } catch (Exception e) {
            log.error("Failed to publish user block event: {}", e.getMessage());
        }
    }

    public void publishUserReportEvent(UUID reportId, UUID reporterId, UUID reportedUserId, String reason) {
        try {
            java.util.Map<String, Object> event = java.util.Map.of(
                    "reportId", reportId,
                    "reporterId", reporterId,
                    "reportedUserId", reportedUserId,
                    "reason", reason,
                    "eventType", "USER_REPORT"
            );
            kafkaTemplate.send(T_CONVERSATION_MANAGEMENT, reportId.toString(), event);
        } catch (Exception e) {
            log.error("Failed to publish user report event: {}", e.getMessage());
        }
    }
}