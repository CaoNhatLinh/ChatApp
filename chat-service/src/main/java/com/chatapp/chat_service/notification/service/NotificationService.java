package com.chatapp.chat_service.notification.service;

import com.chatapp.chat_service.notification.dto.NotificationDto;
import com.chatapp.chat_service.notification.dto.NotificationStatsDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Facade service for backward compatibility.
 * Delegates to specialized sub-services:
 * - NotificationCreationService: creating notifications
 * - NotificationQueryService: reading/searching notifications
 * - NotificationActionService: marking read, deleting
 *
 * New code should inject the specific sub-service directly.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationCreationService creationService;
    private final NotificationQueryService queryService;
    private final NotificationActionService actionService;


    public NotificationDto createNotification(UUID userId, String title, String body, String type, Map<String, Object> metadata) {
        return creationService.createNotification(userId, title, body, type, metadata);
    }

    public void createMessageNotification(UUID recipientId, UUID conversationId, UUID messageId,
                                          String senderName, String messageContent) {
        creationService.createMessageNotification(recipientId, conversationId, messageId, senderName, messageContent);
    }

    public void createReactionNotification(UUID recipientId, UUID reactorId, String reactorName,
                                           String emoji, UUID conversationId, UUID messageId) {
        creationService.createReactionNotification(recipientId, reactorId, reactorName, emoji, conversationId, messageId);
    }

    public void createMentionNotification(UUID recipientId, UUID mentionerId, String mentionerName,
                                          UUID conversationId, UUID messageId, String messageContent) {
        creationService.createMentionNotification(recipientId, mentionerId, mentionerName, conversationId, messageId, messageContent);
    }

    public void createFriendRequestNotification(UUID recipientId, UUID requesterId, String requesterName) {
        creationService.createFriendRequestNotification(recipientId, requesterId, requesterName);
    }

    public void createConversationInviteNotification(UUID recipientId, UUID inviterId, String inviterName,
                                                     UUID conversationId, String conversationName) {
        creationService.createConversationInviteNotification(recipientId, inviterId, inviterName, conversationId, conversationName);
    }

    public void sendFriendshipUpdateNotification(UUID recipientId, UUID senderId, String status) {
        creationService.sendFriendshipUpdateNotification(recipientId, senderId, status);
    }

    public void createFriendshipNotificationInternal(UUID recipientId, UUID senderId, String status) {
        creationService.createFriendshipNotificationInternal(recipientId, senderId, status);
    }

    public void createPollNotification(UUID recipientId, UUID creatorId, String creatorName,
                                       UUID conversationId, UUID pollId, String pollQuestion) {
        creationService.createPollNotification(recipientId, creatorId, creatorName, conversationId, pollId, pollQuestion);
    }

    public void createPinMessageNotification(UUID recipientId, UUID pinnerId, String pinnerName,
                                             UUID conversationId, UUID messageId, String messageContent) {
        creationService.createPinMessageNotification(recipientId, pinnerId, pinnerName, conversationId, messageId, messageContent);
    }

    public void createSystemNotification(UUID recipientId, String title, String body, Map<String, Object> metadata) {
        creationService.createSystemNotification(recipientId, title, body, metadata);
    }


    public NotificationPage getNotifications(UUID userId, int page, int size) {
        return queryService.getNotifications(userId, page, size);
    }

    public NotificationPage getNotifications(UUID userId, Pageable pageable) {
        return queryService.getNotifications(userId, pageable);
    }

    public NotificationPage getNotificationsByType(UUID userId, String type, int page, int size) {
        return queryService.getNotificationsByType(userId, type, page, size);
    }

    public Long getUnreadCount(UUID userId) {
        return queryService.getUnreadCount(userId);
    }

    public boolean hasUnreadNotifications(UUID userId) {
        return queryService.hasUnreadNotifications(userId);
    }

    public List<NotificationDto> getUnreadNotifications(UUID userId) {
        return queryService.getUnreadNotifications(userId);
    }

    public Optional<NotificationDto> getLatestNotification(UUID userId) {
        return queryService.getLatestNotification(userId);
    }

    public List<NotificationDto> getNotificationsByDateRange(UUID userId, Instant startDate, Instant endDate) {
        return queryService.getNotificationsByDateRange(userId, startDate, endDate);
    }

    public List<NotificationDto> searchNotifications(UUID userId, String searchTerm, int limit) {
        return queryService.searchNotifications(userId, searchTerm, limit);
    }

    public NotificationStatsDto getNotificationStats(UUID userId) {
        return queryService.getNotificationStats(userId);
    }


    public void markAsRead(UUID userId, UUID notificationId) {
        actionService.markAsRead(userId, notificationId);
    }

    public void markAllAsRead(UUID userId) {
        actionService.markAllAsRead(userId);
    }

    public void bulkMarkAsRead(UUID userId, List<UUID> notificationIds) {
        actionService.bulkMarkAsRead(userId, notificationIds);
    }

    public void deleteNotification(UUID userId, UUID notificationId) {
        actionService.deleteNotification(userId, notificationId);
    }

    public void deleteAllNotifications(UUID userId) {
        actionService.deleteAllNotifications(userId);
    }


    public static class NotificationPage {
        private final List<NotificationDto> content;
        private final boolean hasNext;
        private final boolean hasContent;

        public NotificationPage(List<NotificationDto> content, boolean hasNext, boolean hasContent) {
            this.content = content;
            this.hasNext = hasNext;
            this.hasContent = hasContent;
        }

        public List<NotificationDto> getContent() { return content; }
        public boolean isHasNext() { return hasNext; }
        public boolean isHasContent() { return hasContent; }
    }
}