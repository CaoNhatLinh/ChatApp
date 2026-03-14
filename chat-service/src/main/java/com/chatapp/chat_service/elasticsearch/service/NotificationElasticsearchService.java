package com.chatapp.chat_service.elasticsearch.service;

import com.chatapp.chat_service.elasticsearch.document.NotificationDocument;
import com.chatapp.chat_service.elasticsearch.repository.NotificationElasticsearchRepository;
import com.chatapp.chat_service.notification.entity.Notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
public class NotificationElasticsearchService {

    private static final Logger log = LoggerFactory.getLogger(NotificationElasticsearchService.class);
    private final NotificationElasticsearchRepository elasticsearchRepository;

    public void indexNotification(Notification notification) {
        try {
            NotificationDocument document = new NotificationDocument(
                    notification.getNotificationId().toString(),
                    notification.getNotificationId(),
                    notification.getUserId(),
                    notification.getTitle(),
                    notification.getBody(),
                    notification.getType(),
                    notification.getMetadata(),
                    notification.getIsRead(),
                    notification.getCreatedAt()
            );

            elasticsearchRepository.save(document);
            log.info("Indexed notification: {}", notification.getNotificationId());
        } catch (Exception e) {
            log.error("Failed to index notification: {}", notification.getNotificationId(), e);
        }
    }

    public void deleteNotification(UUID notificationId, UUID userId) {
        try {
            List<NotificationDocument> documents = elasticsearchRepository.findByNotificationIdAndUserId(notificationId, userId);
            if (!documents.isEmpty()) {
                elasticsearchRepository.deleteAll(documents);
                log.info("Deleted notification in Elasticsearch: {}", notificationId);
            }
        } catch (Exception e) {
            log.error("Failed to delete notification in Elasticsearch: {}", notificationId, e);
        }
    }

    public void deleteAllNotificationsByUserId(UUID userId) {
        try {
            List<NotificationDocument> documents = elasticsearchRepository.findByUserId(userId);
            if (!documents.isEmpty()) {
                elasticsearchRepository.deleteAll(documents);
                log.info("Deleted all notifications in Elasticsearch for user: {}", userId);
            }
        } catch (Exception e) {
            log.error("Failed to delete all notifications in Elasticsearch for user: {}", userId, e);
        }
    }

    public List<Notification> searchNotifications(UUID userId, String searchTerm, int limit) {
        // Find documents
        List<NotificationDocument> documents = elasticsearchRepository
                .findByUserIdAndTitleContainingIgnoreCaseOrUserIdAndBodyContainingIgnoreCaseOrderByCreatedAtDesc(
                        userId, searchTerm, userId, searchTerm);

        // Map back to Notification entity, limited by `limit`
        return documents.stream()
                .limit(limit)
                .map(doc -> {
                    Notification notif = new Notification();
                    notif.setNotificationId(doc.getNotificationId());
                    notif.setUserId(doc.getUserId());
                    notif.setTitle(doc.getTitle());
                    notif.setBody(doc.getBody());
                    notif.setType(doc.getType());
                    notif.setMetadata(doc.getMetadata());
                    notif.setIsRead(doc.getIsRead());
                    notif.setCreatedAt(doc.getCreatedAt());
                    return notif;
                })
                .collect(Collectors.toList());
    }
}
