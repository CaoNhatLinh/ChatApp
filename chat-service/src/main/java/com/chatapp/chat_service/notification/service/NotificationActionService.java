package com.chatapp.chat_service.notification.service;

import com.chatapp.chat_service.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import com.chatapp.chat_service.elasticsearch.service.NotificationElasticsearchService;

/**
 * Handles notification state mutations:
 * mark read, bulk read, delete, delete all
 */
@Service
@RequiredArgsConstructor
public class NotificationActionService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(NotificationActionService.class);

    private final NotificationRepository notificationRepository;
    private final NotificationHelper helper;

    @Autowired(required = false)
    private NotificationElasticsearchService elasticsearchService;

    public void markAsRead(UUID userId, UUID notificationId) {
        notificationRepository.markAsRead(userId, notificationId);
        helper.clearUserNotificationCache(userId);
        helper.invalidateUnreadCount(userId);

        Map<String, Object> update = new HashMap<>();
        update.put("notificationId", notificationId);
        update.put("isRead", true);
        helper.sendRealtimeUpdate(userId, "/queue/notification-read", update);

        log.info("Marked notification {} as read for user {}", notificationId, userId);
    }

    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsRead(userId);
        helper.clearUserNotificationCache(userId);
        helper.invalidateUnreadCount(userId);

        Map<String, Object> update = new HashMap<>();
        update.put("action", "MARK_ALL_READ");
        update.put("timestamp", Instant.now());
        helper.sendRealtimeUpdate(userId, "/queue/notification-read", update);

        log.info("Marked all notifications as read for user {}", userId);
    }

    public void bulkMarkAsRead(UUID userId, List<UUID> notificationIds) {
        if (notificationIds == null || notificationIds.isEmpty()) return;

        notificationRepository.bulkMarkAsRead(userId, notificationIds);
        helper.clearUserNotificationCache(userId);
        helper.invalidateUnreadCount(userId);

        Map<String, Object> update = new HashMap<>();
        update.put("notificationIds", notificationIds);
        update.put("action", "BULK_MARK_READ");
        update.put("timestamp", Instant.now());
        helper.sendRealtimeUpdate(userId, "/queue/notification-read", update);

        log.info("Bulk marked {} notifications as read for user {}", notificationIds.size(), userId);
    }

    public void deleteNotification(UUID userId, UUID notificationId) {
        notificationRepository.deleteByUserIdAndNotificationId(userId, notificationId);
        helper.clearUserNotificationCache(userId);
        helper.invalidateUnreadCount(userId);
        
        if (elasticsearchService != null) {
            elasticsearchService.deleteNotification(notificationId, userId);
        }

        Map<String, Object> update = new HashMap<>();
        update.put("notificationId", notificationId);
        update.put("action", "DELETE");
        helper.sendRealtimeUpdate(userId, "/queue/notification-delete", update);

        log.info("Deleted notification {} for user {}", notificationId, userId);
    }

    public void deleteAllNotifications(UUID userId) {
        notificationRepository.deleteByUserId(userId);
        helper.clearUserNotificationCache(userId);
        helper.invalidateUnreadCount(userId);
        
        if (elasticsearchService != null) {
            elasticsearchService.deleteAllNotificationsByUserId(userId);
        }

        Map<String, Object> update = new HashMap<>();
        update.put("action", "DELETE_ALL");
        update.put("timestamp", Instant.now());
        helper.sendRealtimeUpdate(userId, "/queue/notification-delete", update);

        log.info("Deleted all notifications for user {}", userId);
    }
}
