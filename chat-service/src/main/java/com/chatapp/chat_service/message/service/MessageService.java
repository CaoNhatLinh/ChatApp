package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.elasticsearch.service.ConversationElasticsearchService;
import com.chatapp.chat_service.elasticsearch.service.MessageElasticsearchService;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.dto.MessageSummary;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageMention;
import com.chatapp.chat_service.message.exception.MessageSaveException;
import com.chatapp.chat_service.message.exception.MessageValidationException;
import com.chatapp.chat_service.message.mapper.MessageMapper;
import com.chatapp.chat_service.message.repository.MessageMentionRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.chatapp.chat_service.conversation.entity.UserConversation;
import com.chatapp.chat_service.conversation.repository.UserConversationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing message operations (send, retrieve, validate).
 * High-performance focused with batch enrichment provided by MessageEnrichmentService.
 */
@Service
@Slf4j
public class MessageService {

    private final MessageRepository messageRepository;
    private final MessageMentionRepository messageMentionRepository;
    private final SecurityContextHelper securityContextHelper;
    private final ConversationElasticsearchService conversationElasticsearchService;
    private final MessageElasticsearchService messageElasticsearchService;
    private final MessageMapper messageMapper;
    private final MessageValidationService messageValidationService;
    private final MessageEnrichmentService enrichmentService;
    private final UserConversationRepository userConversationRepository;

    public MessageService(MessageRepository messageRepository,
            MessageMentionRepository messageMentionRepository,
            SecurityContextHelper securityContextHelper,
            MessageMapper messageMapper,
            MessageValidationService messageValidationService,
            MessageEnrichmentService enrichmentService,
            UserConversationRepository userConversationRepository,
            @Autowired(required = false) MessageElasticsearchService messageElasticsearchService,
            @Autowired(required = false) ConversationElasticsearchService conversationElasticsearchService) {
        this.messageRepository = messageRepository;
        this.messageMentionRepository = messageMentionRepository;
        this.securityContextHelper = securityContextHelper;
        this.messageMapper = messageMapper;
        this.messageValidationService = messageValidationService;
        this.enrichmentService = enrichmentService;
        this.userConversationRepository = userConversationRepository;
        this.messageElasticsearchService = messageElasticsearchService;
        this.conversationElasticsearchService = conversationElasticsearchService;
    }

    /**
     * Sends a new message and indexes it for search.
     */
    public MessageResponseDto sendMessage(MessageRequest request) {
        try {
            UUID senderId = request.getSenderId() != null ? request.getSenderId()
                    : securityContextHelper.getCurrentUserId();

            messageValidationService.validateMessagePermission(request.getConversationId(), senderId);

            UUID messageId = request.getMessageId() != null ? request.getMessageId() : Uuids.timeBased();
            Message.MessageKey key = new Message.MessageKey(
                    request.getConversationId(),
                    messageId);

            Message message = Message.builder()
                    .key(key)
                    .senderId(senderId)
                    .content(request.getContent())
                    .createdAt(Instant.now())
                    .isDeleted(false)
                    .type(request.getType())
                    .replyTo(request.getReplyTo())
                    .build();

            Message savedMessage = messageRepository.save(message);
            
            if (request.getMentionedUserIds() != null && !request.getMentionedUserIds().isEmpty()) {
                List<MessageMention> mentions = request.getMentionedUserIds().stream()
                        .map(mentionedUserId -> MessageMention.builder()
                                .key(new MessageMention.MessageMentionKey(
                                        request.getConversationId(),
                                        savedMessage.getKey().getMessageId(),
                                        mentionedUserId))
                                .build())
                        .collect(Collectors.toList());
                messageMentionRepository.saveAll(mentions);
            }

            if (conversationElasticsearchService != null) {
                try {
                    MessageSummary messageSummary = MessageSummary.builder()
                            .messageId(savedMessage.getKey().getMessageId())
                            .senderId(savedMessage.getSenderId())
                            .content(savedMessage.getContent())
                            .type(savedMessage.getType())
                            .createdAt(savedMessage.getCreatedAt())
                            .build();
                    conversationElasticsearchService.updateLastMessage(request.getConversationId(), messageSummary);
                } catch (Exception e) {
                    log.error("Failed to update last message in ES: {}", e.getMessage());
                }
            }

            if (messageElasticsearchService != null) {
                try {
                    messageElasticsearchService.indexMessage(savedMessage, request.getMentionedUserIds());
                } catch (Exception e) {
                    log.error("Failed to index message in ES: {}", e.getMessage());
                }
            }

            updateUserConversationsActivity(request.getConversationId(), savedMessage.getCreatedAt());

            List<MessageResponseDto> enrichedList = enrichmentService.enrichMessages(
                    request.getConversationId(), 
                    Collections.singletonList(savedMessage), 
                    null
            );
            
            return enrichedList.isEmpty() ? messageMapper.toResponseDto(savedMessage, senderId) : enrichedList.get(0);

        } catch (IllegalArgumentException e) {
            throw new MessageValidationException("Invalid message data: " + e.getMessage(), e);
        } catch (org.springframework.dao.DataAccessException e) {
            throw new MessageSaveException("Failed to save message to database", e);
        } catch (Exception e) {
            log.error("Failed to send message", e);
            throw new RuntimeException("Failed to send message", e);
        }
    }

    public org.springframework.data.domain.Slice<MessageResponseDto> getLatestMessages(UUID conversationId, Pageable pageable) {
        UUID userId = securityContextHelper.getCurrentUserId();
        messageValidationService.validateConversationMembership(conversationId, userId);
        
        int limit = pageable.getPageSize();
        List<Message> messages = messageRepository.findByConversationIdWithLimit(conversationId, limit);
        
        List<MessageResponseDto> enrichedMessages = enrichmentService.enrichMessages(conversationId, messages, userId);
        boolean hasNext = messages.size() >= limit;
        return new org.springframework.data.domain.SliceImpl<>(enrichedMessages, pageable, hasNext);
    }

    public List<MessageResponseDto> getLatestMessages(UUID conversationId) {
        return getLatestMessages(conversationId, PageRequest.of(0, 20)).getContent();
    }

    public org.springframework.data.domain.Slice<MessageResponseDto> getOlderMessages(UUID conversationId, UUID beforeMessageId, Pageable pageable) {
        UUID userId = securityContextHelper.getCurrentUserId();
        messageValidationService.validateConversationMembership(conversationId, userId);

        List<Message> olderMessages = messageRepository.findOlderMessages(conversationId, beforeMessageId);
        
        List<MessageResponseDto> enrichedMessages = enrichmentService.enrichMessages(conversationId, olderMessages, userId);
        boolean hasNext = olderMessages.size() >= pageable.getPageSize();
        return new org.springframework.data.domain.SliceImpl<>(enrichedMessages, pageable, hasNext);
    }

    public org.springframework.data.domain.Slice<MessageResponseDto> getConversationMessages(UUID conversationId, LocalDateTime before,
            LocalDateTime after, Pageable pageable) {
        UUID userId = securityContextHelper.getCurrentUserId();
        messageValidationService.validateConversationMembership(conversationId, userId);

        if (pageable.getPageSize() > 100) {
            pageable = PageRequest.of(pageable.getPageNumber(), 100);
        }

        List<Message> messages;
        int limit = pageable.getPageSize();

        if (before != null && after != null) {
            Instant beforeInstant = before.atZone(ZoneId.systemDefault()).toInstant();
            Instant afterInstant = after.atZone(ZoneId.systemDefault()).toInstant();
            UUID beforeUuid = com.datastax.oss.driver.api.core.uuid.Uuids.endOf(beforeInstant.toEpochMilli());
            UUID afterUuid = com.datastax.oss.driver.api.core.uuid.Uuids.startOf(afterInstant.toEpochMilli());
            messages = messageRepository.findByConversationIdBetweenMessageIds(conversationId, afterUuid, beforeUuid, limit);
        } else if (before != null) {
            Instant beforeInstant = before.atZone(ZoneId.systemDefault()).toInstant();
            UUID beforeUuid = com.datastax.oss.driver.api.core.uuid.Uuids.endOf(beforeInstant.toEpochMilli());
            messages = messageRepository.findByConversationIdBeforeMessageId(conversationId, beforeUuid, limit);
        } else if (after != null) {
            Instant afterInstant = after.atZone(ZoneId.systemDefault()).toInstant();
            UUID afterUuid = com.datastax.oss.driver.api.core.uuid.Uuids.startOf(afterInstant.toEpochMilli());
            messages = messageRepository.findByConversationIdAfterMessageId(conversationId, afterUuid, limit);
        } else {
            return getLatestMessages(conversationId, pageable);
        }

        List<MessageResponseDto> enrichedMessages = enrichmentService.enrichMessages(conversationId, messages, userId);
        boolean hasNext = messages.size() >= limit;
        return new org.springframework.data.domain.SliceImpl<>(enrichedMessages, pageable, hasNext);
    }

    public List<MessageResponseDto> getConversationMessages(UUID conversationId, LocalDateTime before,
            LocalDateTime after) {
        return getConversationMessages(conversationId, before, after, PageRequest.of(0, 20)).getContent();
    }

    /**
     * Updates the lastActivityAt for all members' UserConversation records.
     * In Cassandra, since lastActivityAt is part of the clustering key, we must delete + re-insert.
     */
    private void updateUserConversationsActivity(UUID conversationId, Instant activityTime) {
        try {
            List<UserConversation> userConvs = userConversationRepository.findByConversationId(conversationId);
            for (UserConversation uc : userConvs) {
                userConversationRepository.delete(uc);
                UserConversation updated = UserConversation.builder()
                        .key(new UserConversation.UserConversationKey(
                                uc.getKey().getUserId(),
                                uc.getKey().isPinned(),
                                activityTime,
                                conversationId))
                        .joinedAt(uc.getJoinedAt())
                        .role(uc.getRole())
                        .build();
                userConversationRepository.save(updated);
            }
            log.debug("Updated lastActivityAt for conversation {} to {}", conversationId, activityTime);
        } catch (Exception e) {
            log.error("Failed to update user conversations activity for {}: {}", conversationId, e.getMessage());
        }
    }

    public List<MessageResponseDto> getLatestMessagesAlternative(UUID conversationId, Pageable pageable) {
        UUID userId = securityContextHelper.getCurrentUserId();
        messageValidationService.validateConversationMembership(conversationId, userId);

        List<Message> messages = messageRepository.findByKeyConversationIdOrderByKeyMessageIdDesc(conversationId, pageable);

        return enrichmentService.enrichMessages(conversationId, messages, userId);
    }
}