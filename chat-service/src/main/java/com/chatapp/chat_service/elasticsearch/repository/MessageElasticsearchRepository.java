package com.chatapp.chat_service.elasticsearch.repository;

import com.chatapp.chat_service.elasticsearch.document.MessageDocument;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
public interface MessageElasticsearchRepository extends ElasticsearchRepository<MessageDocument, String> {
    
    /**
     * Search messages by content (full-text search)
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            UUID conversationId, String content, Pageable pageable);
    
    /**
     * Filter messages by sender
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndSenderIdOrderByCreatedAtDesc(
            UUID conversationId, UUID senderId, Pageable pageable);
    
    /**
     * Filter messages by type
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndTypeOrderByCreatedAtDesc(
            UUID conversationId, String type, Pageable pageable);
    
    /**
     * Combined search: content + sender
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndSenderIdAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            UUID conversationId, UUID senderId, String content, Pageable pageable);
    
    /**
     * Combined search: content + type
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            UUID conversationId, String type, String content, Pageable pageable);
    
    /**
     * Combined search: sender + type
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndSenderIdAndTypeOrderByCreatedAtDesc(
            UUID conversationId, UUID senderId, String type, Pageable pageable);
    
    /**
     * Combined search: content + sender + type
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndSenderIdAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            UUID conversationId, UUID senderId, String type, String content, Pageable pageable);
    
    /**
     * Find messages mentioning a specific user
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseAndMentionedUserIdsContainingOrderByCreatedAtDesc(
            UUID conversationId, UUID mentionedUserId, Pageable pageable);
    
    /**
     * Find by message ID
     */
    List<MessageDocument> findByMessageId(UUID messageId);
}
