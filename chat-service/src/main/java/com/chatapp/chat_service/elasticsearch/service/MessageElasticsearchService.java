package com.chatapp.chat_service.elasticsearch.service;

import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.elasticsearch.document.MessageDocument;
import com.chatapp.chat_service.elasticsearch.repository.MessageElasticsearchRepository;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.repository.MessageAttachmentRepository;
import com.chatapp.chat_service.message.repository.MessageMentionRepository;
import com.chatapp.chat_service.message.repository.MessageReactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
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
    private final MessageAttachmentRepository messageAttachmentRepository;

    private static final int MAX_SCAN_SIZE = 2000;

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

            // Check if message has attachments
            boolean hasAttachments = false;
            try {
                hasAttachments = messageAttachmentRepository
                        .findByConversationIdAndMessageId(
                                message.getKey().getConversationId(),
                                message.getKey().getMessageId())
                        .size() > 0;
            } catch (Exception e) {
                log.debug("Error checking attachments for indexing: {}", e.getMessage());
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
                    .hasAttachments(hasAttachments)
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
     * Search messages with richer filters
     */
    public Page<MessageDocument> searchMessages(
            UUID conversationId,
            String content,
            UUID senderId,
            String messageType,
            Instant from,
            Instant to,
            UUID mentionedUserId,
            UUID replyToMessageId,
            Pageable pageable) {

        if (from == null && to == null && mentionedUserId == null && replyToMessageId == null) {
            return searchMessages(conversationId, content, senderId, messageType, pageable);
        }

        int scanSize = Math.max(100, pageable.getPageSize() * 20);
        Pageable scanPageable = PageRequest.of(0, scanSize);

        Page<MessageDocument> scanResult = elasticsearchRepository
                .findByConversationIdAndIsDeletedFalseOrderByCreatedAtDesc(conversationId, scanPageable);

        Instant fromInstant = from;
        Instant toInstant = to;
        String keyword = content != null ? content.trim().toLowerCase() : null;
        String normalizedType = messageType != null ? messageType.trim().toUpperCase() : null;

        List<MessageDocument> filtered = scanResult.getContent().stream()
                .filter(doc -> matchesAdvancedFilters(doc, keyword, senderId, normalizedType, mentionedUserId, replyToMessageId, fromInstant, toInstant))
                .toList();

        int start = (int) pageable.getOffset();
        if (start >= filtered.size()) {
            return Page.empty(pageable);
        }

        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        return new PageImpl<>(filtered.subList(start, end), pageable, filtered.size());
    }

    /**
     * Search messages across conversations with flexible filters
     */
    public Page<MessageDocument> searchMessages(
            List<UUID> conversationIds,
            String content,
            UUID senderId,
            String messageType,
            Instant from,
            Instant to,
            UUID mentionedUserId,
            UUID replyToMessageId,
            Pageable pageable) {

        if (conversationIds == null || conversationIds.isEmpty()) {
            return Page.empty(pageable);
        }

        List<UUID> normalizedConversationIds = conversationIds.stream()
                .distinct()
                .toList();

        if (normalizedConversationIds.size() == 1) {
            if (from == null && to == null && mentionedUserId == null && replyToMessageId == null) {
                return searchMessages(normalizedConversationIds.get(0), content, senderId, messageType, pageable);
            }
            return filterByAdvancedCriteria(normalizedConversationIds, content, senderId, messageType, from, to, mentionedUserId, replyToMessageId, pageable);
        }

        Page<MessageDocument> base = searchMessages(normalizedConversationIds, content, senderId, messageType, pageable);
        if (from == null && to == null && mentionedUserId == null && replyToMessageId == null) {
            return base;
        }

        return filterByAdvancedCriteria(normalizedConversationIds, content, senderId, messageType, from, to, mentionedUserId, replyToMessageId, pageable);
    }

    private Page<MessageDocument> searchMessages(
            List<UUID> conversationIds,
            String content,
            UUID senderId,
            String messageType,
            Pageable pageable) {

        boolean hasContent = content != null && !content.trim().isEmpty();
        boolean hasSender = senderId != null;
        boolean hasType = messageType != null && !messageType.trim().isEmpty();

        if (hasContent && hasSender && hasType) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndSenderIdAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationIds, senderId, messageType.toUpperCase(), content, pageable);
        } else if (hasContent && hasSender) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndSenderIdAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationIds, senderId, content, pageable);
        } else if (hasContent && hasType) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndTypeAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationIds, messageType.toUpperCase(), content, pageable);
        } else if (hasSender && hasType) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndSenderIdAndTypeOrderByCreatedAtDesc(
                            conversationIds, senderId, messageType.toUpperCase(), pageable);
        } else if (hasContent) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            conversationIds, content, pageable);
        } else if (hasSender) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndSenderIdOrderByCreatedAtDesc(
                            conversationIds, senderId, pageable);
        } else if (hasType) {
            return elasticsearchRepository
                    .findByConversationIdInAndIsDeletedFalseAndTypeOrderByCreatedAtDesc(
                            conversationIds, messageType.toUpperCase(), pageable);
        } else {
            return elasticsearchRepository.findByConversationIdInAndIsDeletedFalseOrderByCreatedAtDesc(conversationIds, pageable);
        }
    }

    /**
     * Filter by from/to/mentioned/reply across searched documents with stable pagination.
     */
    private Page<MessageDocument> filterByAdvancedCriteria(
            List<UUID> conversationIds,
            String content,
            UUID senderId,
            String messageType,
            Instant from,
            Instant to,
            UUID mentionedUserId,
            UUID replyToMessageId,
            Pageable pageable) {

        int targetOffset = (int) pageable.getOffset();
        int targetSize = pageable.getPageSize();
        int neededResults = targetOffset + targetSize;
        int scanPageSize = Math.min(MAX_SCAN_SIZE, Math.max(200, targetSize * 20));

        List<MessageDocument> filtered = new ArrayList<>();
        int pageIndex = 0;

        while (filtered.size() < neededResults) {
            Pageable scanPageable = PageRequest.of(pageIndex, scanPageSize);
            Page<MessageDocument> scanResult = searchMessages(conversationIds, content, senderId, messageType, scanPageable);

            if (scanResult.isEmpty()) {
                break;
            }

            for (MessageDocument doc : scanResult.getContent()) {
                if (matchesAdvancedFilters(doc, content != null ? content.trim().toLowerCase() : null,
                        senderId,
                        messageType != null ? messageType.trim().toUpperCase() : null,
                        mentionedUserId,
                        replyToMessageId,
                        from,
                        to)) {
                    filtered.add(doc);
                }
            }

            if (!scanResult.hasNext()) {
                break;
            }

            pageIndex++;
        }

        if (targetOffset >= filtered.size()) {
            return Page.empty(pageable);
        }

        int end = Math.min(targetOffset + targetSize, filtered.size());
        return new PageImpl<>(filtered.subList(targetOffset, end), pageable, filtered.size());
    }

    private boolean matchesAdvancedFilters(
            MessageDocument doc,
            String normalizedContent,
            UUID senderId,
            String normalizedType,
            UUID mentionedUserId,
            UUID replyToMessageId,
            Instant from,
            Instant to) {

        if (doc == null) {
            return false;
        }

        if (normalizedContent != null && !normalizedContent.isBlank()) {
            String messageContent = Optional.ofNullable(doc.getContent()).orElse("").toLowerCase();
            if (!messageContent.contains(normalizedContent)) {
                return false;
            }
        }

        if (senderId != null && !senderId.equals(doc.getSenderId())) {
            return false;
        }

        if (normalizedType != null && !normalizedType.isBlank()) {
            String docType = Optional.ofNullable(doc.getType()).orElse("").toUpperCase();
            if (!normalizedType.equals(docType)) {
                return false;
            }
        }

        if (mentionedUserId != null) {
            List<UUID> mentioned = doc.getMentionedUserIds();
            if (mentioned == null || !mentioned.contains(mentionedUserId)) {
                return false;
            }
        }

        if (replyToMessageId != null && !replyToMessageId.equals(doc.getReplyTo())) {
            return false;
        }

        Instant createdAt = doc.getCreatedAt();
        if (createdAt != null) {
            if (from != null && createdAt.isBefore(from)) {
                return false;
            }
            if (to != null && createdAt.isAfter(to)) {
                return false;
            }
        }

        return true;
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
