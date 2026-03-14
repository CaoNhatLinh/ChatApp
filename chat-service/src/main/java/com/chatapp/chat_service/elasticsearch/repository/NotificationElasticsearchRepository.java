package com.chatapp.chat_service.elasticsearch.repository;

import com.chatapp.chat_service.elasticsearch.document.NotificationDocument;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationElasticsearchRepository extends ElasticsearchRepository<NotificationDocument, String> {
    
    List<NotificationDocument> findByUserIdAndTitleContainingIgnoreCaseOrUserIdAndBodyContainingIgnoreCaseOrderByCreatedAtDesc(
            UUID userId1, String title, UUID userId2, String body);
            
    List<NotificationDocument> findByNotificationIdAndUserId(UUID notificationId, UUID userId);
    
    List<NotificationDocument> findByUserId(UUID userId);
}
