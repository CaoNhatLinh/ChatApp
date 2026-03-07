package com.chatapp.chat_service.elasticsearch.service;

import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.elasticsearch.document.MessageDocument;
import com.chatapp.chat_service.elasticsearch.repository.MessageElasticsearchRepository;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageMention;
import com.chatapp.chat_service.message.repository.MessageMentionRepository;
import com.chatapp.chat_service.message.repository.MessageReactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for indexing and searching messages using Elasticsearch
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
@Slf4j
public class MessageElasticsearchService {

    private final MessageElasticsearchRepository elasticsearchRepository;
    private final UserRepository userRepository;
    private final MessageMentionRepository messageMentionRepository;
    private final MessageReactionRepository messageReactionRepository;

    /**
     * Index a message in Elasticsearch (Basic version)
     */
    public void indexMessage(Message message) {
        indexMessage(message, null);
    }

    /**
     * Index a message in Elasticsearch with pre-fetched data (Performance optimized)
     */
    public void indexMessage(Message message, List<UUID> preFetchedMentions) {
        try {
            Optional<User> senderOpt = userRepository.findById(message.getSenderId());
            
            List<UUID> mentionedUserIds = preFetchedMentions;
            if (mentionedUserIds == null) {
                mentionedUserIds = messageMentionRepository
                        .findByKeyConversationIdAndKeyMessageId(
                                message.getKey().getConversationId(),
                                message.getKey().getMessageId())
                        .stream()
                        .map(mention -> mention.getKey().getMentionedUserId())
                        .collect(Collectors.toList());
            }
            
            int reactionCount = 0;
            if (message.getEditedAt() != null) {
                try {
                    reactionCount = messageReactionRepository
                            .findByConversationIdAndMessageId(
                                    message.getKey().getConversationId(),
                                    message.getKey().getMessageId())
                            .size();
                } catch (Exception e) {
                    log.debug("Error fetching reaction count for indexing: {}", e.getMessage());
                }
            }

            MessageDocument document = MessageDocument.builder()
                    .id(message.getKey().getConversationId() + ":" + message.getKey().getMessageId())
                    .conversationId(message.getKey().getConversationId())
                    .messageId(message.getKey().getMessageId())
                    .senderId(message.getSenderId())
                    .senderUsername(senderOpt.map(User::getUsername).orElse(null))
                    .senderDisplayName(senderOpt.map(User::getDisplayName).orElse(null))
                    .content(message.getContent())
                    .type(message.getType())
                    .createdAt(message.getCreatedAt())
                    .editedAt(message.getEditedAt())
                    .isDeleted(message.isDeleted())
                    .replyTo(message.getReplyTo())
                    .mentionedUserIds(mentionedUserIds)
                    .reactionCount(reactionCount)
                    .hasAttachments(false) 
                    .build();

            elasticsearchRepository.save(document);
            log.info("Successfully indexed message: {} in conversation: {}", 
                    message.getKey().getMessageId(), message.getKey().getConversationId());
        } catch (Exception e) {
            log.error("CRITICAL: Failed to index message: {}. Reason: {}", 
                    message.getKey().getMessageId(), e.getMessage());
        }
    }

    /**
     * Search messages with flexible filters
     * 
     * @param conversationId Conversation ID (required)
     * @param content Content to search (optional, full-text search)
     * @param senderId Filter by sender (optional)
     * @param messageType Filter by type: TEXT, IMAGE, FILE, etc. (optional)
     * @param pageable Pagination
     * @return Page of matching messages
     */
    public Page<MessageDocument> searchMessages(
            UUID conversationId,
            String content,
            UUID senderId,
            String messageType,
            Pageable pageable) {
        
        boolean hasContent = content != null && !content.trim().isEmpty();
        boolean hasSender = senderId != null;
        boolean hasType = messageType != null && !messageType.trim().isEmpty();

        if (hasContent && hasSender && hasType) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndSenderIdAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationId, senderId, messageType.toUpperCase(), content, pageable);
        } else if (hasContent && hasSender) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndSenderIdAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationId, senderId, content, pageable);
        } else if (hasContent && hasType) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationId, messageType.toUpperCase(), content, pageable);
        } else if (hasSender && hasType) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndSenderIdAndTypeOrderByCreatedAtDesc(
                            conversationId, senderId, messageType.toUpperCase(), pageable);
        } else if (hasContent) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationId, content, pageable);
        } else if (hasSender) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndSenderIdOrderByCreatedAtDesc(
                            conversationId, senderId, pageable);
        } else if (hasType) {
            return elasticsearchRepository
                    .findByConversationIdAndIsDeletedFalseAndTypeOrderByCreatedAtDesc(
                            conversationId, messageType.toUpperCase(), pageable);
        } else {
            return Page.empty(pageable);
        }
    }

    /**
     * Find messages mentioning a specific user
     */
    public Page<MessageDocument> findMessagesMentioningUser(
            UUID conversationId,
            UUID mentionedUserId,
            Pageable pageable) {
        return elasticsearchRepository
                .findByConversationIdAndIsDeletedFalseAndMentionedUserIdsContainingOrderByCreatedAtDesc(
                        conversationId, mentionedUserId, pageable);
    }

    /**
     * Delete message from index (soft delete)
     */
    public void deleteMessage(UUID conversationId, UUID messageId) {
        try {
            List<MessageDocument> documents = elasticsearchRepository.findByMessageId(messageId);
            if (!documents.isEmpty()) {
                MessageDocument document = documents.get(0);
                document.setDeleted(true);
                elasticsearchRepository.save(document);
                log.info("Marked message as deleted in Elasticsearch: {}", messageId);
            }
        } catch (Exception e) {
            log.error("Failed to mark message as deleted: {}", messageId, e);
        }
    }

    /**
     * Update message content (for edits)
     */
    public void updateMessage(Message message) {
        indexMessage(message); 
    }
}
