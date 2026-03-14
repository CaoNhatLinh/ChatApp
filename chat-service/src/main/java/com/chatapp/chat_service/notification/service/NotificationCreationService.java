package com.chatapp.chat_service.notification.service;

import com.chatapp.chat_service.notification.dto.ConversationNotificationDto;
import com.chatapp.chat_service.notification.dto.NotificationDto;
import com.chatapp.chat_service.notification.entity.Notification;
import com.chatapp.chat_service.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import com.chatapp.chat_service.elasticsearch.service.NotificationElasticsearchService;

/**
 * Handles creating notifications for various event types:
 * messages, reactions, mentions, friend requests, invites, polls, pins, system
 */
@Service
@RequiredArgsConstructor
public class NotificationCreationService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(NotificationCreationService.class);

    private final NotificationRepository notificationRepository;
    private final NotificationHelper helper;
    
    @Autowired(required = false)
    private NotificationElasticsearchService elasticsearchService;

    public NotificationDto createNotification(UUID userId, String title, String body, String type, Map<String, Object> metadata) {
        NotificationDto dto = saveNotification(userId, title, body, type, metadata);
        helper.sendRealtimeNotification(userId, dto);
        return dto;
    }

    public NotificationDto saveNotification(UUID userId, String title, String body, String type, Map<String, Object> metadata) {
        UUID notificationId = UUID.randomUUID();

        Notification notification = Notification.builder()
                .userId(userId)
                .notificationId(notificationId)
                .title(title)
                .body(body)
                .type(type)
                .metadata(helper.serializeMetadata(metadata))
                .isRead(false)
                .createdAt(Instant.now())
                .build();

        notificationRepository.save(notification);
        helper.clearUserNotificationCache(userId);
        helper.incrementUnreadCount(userId);
        
        if (elasticsearchService != null) {
            elasticsearchService.indexNotification(notification);
        }

        log.info("Saved notification {} for user {} in database", notificationId, userId);
        return helper.mapToDto(notification);
    }

    public void createMessageNotification(UUID recipientId, UUID conversationId, UUID messageId,
                                          String senderName, String messageContent) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("conversationId", conversationId.toString());
        metadata.put("messageId", messageId.toString());
        metadata.put("senderName", senderName);

        String title = "New message from " + senderName;
        String body = messageContent.length() > 100 ? messageContent.substring(0, 100) + "..." : messageContent;

        createNotification(recipientId, title, body, Notification.NotificationType.MESSAGE, metadata);
        updateConversationNotification(recipientId, conversationId, messageId, messageContent, senderName);
    }

    public void createReactionNotification(UUID recipientId, UUID reactorId, String reactorName,
                                           String emoji, UUID conversationId, UUID messageId) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("conversationId", conversationId.toString());
        metadata.put("messageId", messageId.toString());
        metadata.put("reactorId", reactorId.toString());
        metadata.put("reactorName", reactorName);
        metadata.put("emoji", emoji);

        String title = "New reaction from " + reactorName;
        String body = reactorName + " reacted " + emoji + " to your message";

        createNotification(recipientId, title, body, Notification.NotificationType.REACTION, metadata);
    }

    public void createMentionNotification(UUID recipientId, UUID mentionerId, String mentionerName,
                                          UUID conversationId, UUID messageId, String messageContent) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("conversationId", conversationId.toString());
        metadata.put("messageId", messageId.toString());
        metadata.put("mentionerId", mentionerId.toString());
        metadata.put("mentionerName", mentionerName);

        String title = "Mentioned by " + mentionerName;
        String body = messageContent.length() > 100 ? messageContent.substring(0, 100) + "..." : messageContent;

        createNotification(recipientId, title, body, Notification.NotificationType.MENTION, metadata);
    }

    public void createReplyNotification(UUID recipientId, UUID replierId, String replierName,
                                        UUID conversationId, UUID messageId, UUID replyToMessageId,
                                        String messageContent) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("conversationId", conversationId.toString());
        metadata.put("messageId", messageId.toString());
        metadata.put("replyToMessageId", replyToMessageId.toString());
        metadata.put("replierId", replierId.toString());
        metadata.put("replierName", replierName);

        String title = replierName + " replied to your message";
        String body = messageContent.length() > 100 ? messageContent.substring(0, 100) + "..." : messageContent;

        createNotification(recipientId, title, body, Notification.NotificationType.REPLY, metadata);
    }

    public void createFriendRequestNotification(UUID recipientId, UUID requesterId, String requesterName) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("requesterId", requesterId.toString());
        metadata.put("requesterName", requesterName);

        createNotification(recipientId, "Friend Request", requesterName + " sent you a friend request",
                Notification.NotificationType.FRIEND_REQUEST, metadata);
    }

    public void createConversationInviteNotification(UUID recipientId, UUID inviterId, String inviterName,
                                                     UUID conversationId, String conversationName) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("inviterId", inviterId.toString());
        metadata.put("inviterName", inviterName);
        metadata.put("conversationId", conversationId.toString());
        metadata.put("conversationName", conversationName);

        createNotification(recipientId, "Conversation Invite",
                inviterName + " invited you to \"" + conversationName + "\"",
                Notification.NotificationType.CONVERSATION_INVITE, metadata);
    }

    public void sendFriendshipUpdateNotification(UUID recipientId, UUID senderId, String status) {
        Map<String, Object> metadata = prepareFriendshipMetadata(senderId, status);
        FriendshipNotificationInfo info = determineFriendshipNotificationInfo(recipientId, senderId, status);
        createNotification(info.recipientId, info.title, info.body, info.type, metadata);
    }

    public void createFriendshipNotificationInternal(UUID recipientId, UUID senderId, String status) {
        Map<String, Object> metadata = prepareFriendshipMetadata(senderId, status);
        FriendshipNotificationInfo info = determineFriendshipNotificationInfo(recipientId, senderId, status);
        saveNotification(info.recipientId, info.title, info.body, info.type, metadata);
    }

    private Map<String, Object> prepareFriendshipMetadata(UUID senderId, String status) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("senderId", senderId.toString());
        metadata.put("status", status);
        return metadata;
    }

    private static class FriendshipNotificationInfo {
        UUID recipientId;
        String title;
        String body;
        String type;
    }

    private FriendshipNotificationInfo determineFriendshipNotificationInfo(UUID recipientId, UUID senderId, String status) {
        FriendshipNotificationInfo info = new FriendshipNotificationInfo();
        switch (status.toUpperCase()) {
            case "ACCEPTED":
                info.recipientId = senderId;
                info.title = "Friend request accepted";
                info.body = "Your friend request has been accepted";
                info.type = Notification.NotificationType.FRIEND_REQUEST;
                break;
            case "REJECTED":
                info.recipientId = senderId;
                info.title = "Friend request declined";
                info.body = "Your friend request has been declined";
                info.type = Notification.NotificationType.FRIEND_REQUEST;
                break;
            case "PENDING":
                info.recipientId = recipientId;
                info.title = "New friend request";
                info.body = "You have a new friend request";
                info.type = Notification.NotificationType.FRIEND_REQUEST;
                break;
            default:
                info.recipientId = recipientId;
                info.title = "Friendship update";
                info.body = "There's an update about your friendship";
                info.type = Notification.NotificationType.SYSTEM;
                break;
        }
        return info;
    }

    public void createPollNotification(UUID recipientId, UUID creatorId, String creatorName,
                                       UUID conversationId, UUID pollId, String pollQuestion) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("conversationId", conversationId.toString());
        metadata.put("pollId", pollId.toString());
        metadata.put("creatorId", creatorId.toString());
        metadata.put("creatorName", creatorName);

        createNotification(recipientId, "New poll from " + creatorName,
                "\"" + pollQuestion + "\"",
                Notification.NotificationType.POLL, metadata);
    }

    public void createPinMessageNotification(UUID recipientId, UUID pinnerId, String pinnerName,
                                             UUID conversationId, UUID messageId, String messageContent) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("conversationId", conversationId.toString());
        metadata.put("messageId", messageId.toString());
        metadata.put("pinnerId", pinnerId.toString());
        metadata.put("pinnerName", pinnerName);

        String body = pinnerName + " pinned a message: " +
                (messageContent.length() > 50 ? messageContent.substring(0, 50) + "..." : messageContent);

        createNotification(recipientId, "Message pinned", body,
                Notification.NotificationType.PIN_MESSAGE, metadata);
    }

    public void createSystemNotification(UUID recipientId, String title, String body, Map<String, Object> metadata) {
        createNotification(recipientId, title, body, Notification.NotificationType.SYSTEM, metadata);
    }


    private void updateConversationNotification(UUID userId, UUID conversationId, UUID messageId,
                                                String messageContent, String senderName) {
        ConversationNotificationDto conversationNotification = ConversationNotificationDto.builder()
                .conversationId(conversationId)
                .lastMessageId(messageId)
                .lastMessageContent(messageContent)
                .lastMessageSender(senderName)
                .lastMessageTime(Instant.now())
                .unreadCount(1L)
                .notificationType("NEW_MESSAGE")
                .build();

        helper.sendRealtimeUpdate(userId, "/queue/conversation-updates", Map.of(
                "type", "conversation-notification",
                "data", conversationNotification
        ));
    }
}
