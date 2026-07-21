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
     * Get all messages in a conversation (non-deleted), newest first
     */
    Page<MessageDocument> findByConversationIdAndIsDeletedFalseOrderByCreatedAtDesc(
            UUID conversationId, Pageable pageable);
    
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
     * Search messages in multiple conversations (non-deleted), newest first
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseOrderByCreatedAtDesc(
            List<UUID> conversationIds, Pageable pageable);
    
    /**
     * Search messages in multiple conversations by sender
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndSenderIdOrderByCreatedAtDesc(
            List<UUID> conversationIds, UUID senderId, Pageable pageable);
    
    /**
     * Search messages in multiple conversations by type
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndTypeOrderByCreatedAtDesc(
            List<UUID> conversationIds, String type, Pageable pageable);
    
    /**
     * Search messages in multiple conversations by content
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            List<UUID> conversationIds, String content, Pageable pageable);

    /**
     * Search messages in multiple conversations by content and sender
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndSenderIdAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            List<UUID> conversationIds, UUID senderId, String content, Pageable pageable);
    
    /**
     * Search messages in multiple conversations by content and type
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            List<UUID> conversationIds, String type, String content, Pageable pageable);
    
    /**
     * Search messages in multiple conversations by sender and type
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndSenderIdAndTypeOrderByCreatedAtDesc(
            List<UUID> conversationIds, UUID senderId, String type, Pageable pageable);
    
    /**
     * Search messages in multiple conversations by sender, type and content
     */
    Page<MessageDocument> findByConversationIdInAndIsDeletedFalseAndSenderIdAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            List<UUID> conversationIds, UUID senderId, String type, String content, Pageable pageable);
    
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
