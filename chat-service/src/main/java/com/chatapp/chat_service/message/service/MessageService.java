package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.elasticsearch.service.ConversationElasticsearchService;
import com.chatapp.chat_service.elasticsearch.service.MessageElasticsearchService;
import com.chatapp.chat_service.common.exception.BusinessException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.dto.MessageRevisionDto;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.dto.MessageSummary;
import com.chatapp.chat_service.message.entity.MessageAttachment;
import com.chatapp.chat_service.message.entity.MessageRevision;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageMention;
import com.chatapp.chat_service.message.exception.MessageSaveException;
import com.chatapp.chat_service.message.exception.MessageValidationException;
import com.chatapp.chat_service.message.mapper.MessageMapper;
import com.chatapp.chat_service.message.repository.MessageAttachmentRepository;
import com.chatapp.chat_service.message.repository.MessageMentionRepository;
import com.chatapp.chat_service.message.repository.MessageRevisionRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.notification.service.NotificationService;
import com.chatapp.chat_service.friendship.entity.Friendship;
import com.chatapp.chat_service.friendship.repository.FriendshipRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.chatapp.chat_service.conversation.entity.UserConversation;
import com.chatapp.chat_service.conversation.repository.UserConversationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
    private final MessageAttachmentRepository messageAttachmentRepository;
    private final MessageRevisionRepository messageRevisionRepository;
    private final SecurityContextHelper securityContextHelper;
    private final ConversationElasticsearchService conversationElasticsearchService;
    private final MessageElasticsearchService messageElasticsearchService;
    private final MessageMapper messageMapper;
    private final MessageValidationService messageValidationService;
    private final MessageEnrichmentService enrichmentService;
    private final UserConversationRepository userConversationRepository;
    private final FriendshipRepository friendshipRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;
    private final UserService userService;

    public MessageService(MessageRepository messageRepository,
            MessageMentionRepository messageMentionRepository,
            MessageAttachmentRepository messageAttachmentRepository,
            MessageRevisionRepository messageRevisionRepository,
            SecurityContextHelper securityContextHelper,
            MessageMapper messageMapper,
            MessageValidationService messageValidationService,
            MessageEnrichmentService enrichmentService,
            UserConversationRepository userConversationRepository,
            FriendshipRepository friendshipRepository,
            SimpMessagingTemplate messagingTemplate,
            NotificationService notificationService,
            UserService userService,
            @Autowired(required = false) MessageElasticsearchService messageElasticsearchService,
            @Autowired(required = false) ConversationElasticsearchService conversationElasticsearchService) {
        this.messageRepository = messageRepository;
        this.messageMentionRepository = messageMentionRepository;
        this.messageAttachmentRepository = messageAttachmentRepository;
        this.messageRevisionRepository = messageRevisionRepository;
        this.securityContextHelper = securityContextHelper;
        this.messageMapper = messageMapper;
        this.messageValidationService = messageValidationService;
        this.enrichmentService = enrichmentService;
        this.userConversationRepository = userConversationRepository;
        this.friendshipRepository = friendshipRepository;
        this.messagingTemplate = messagingTemplate;
        this.notificationService = notificationService;
        this.userService = userService;
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

                if (request.getAttachments() != null && !request.getAttachments().isEmpty()) {
                List<MessageAttachment> attachments = request.getAttachments().stream()
                    .map(attachment -> MessageAttachment.builder()
                        .key(new MessageAttachment.MessageAttachmentKey(
                            request.getConversationId(),
                            savedMessage.getKey().getMessageId(),
                            UUID.randomUUID()))
                        .attachmentType(attachment.getResourceType())
                        .fileName(attachment.getFileName())
                        .url(attachment.getUrl())
                        .fileSize(attachment.getFileSize())
                        .mimeType(attachment.getContentType())
                        .build())
                    .collect(Collectors.toList());
                messageAttachmentRepository.saveAll(attachments);
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
        dispatchNotificationsForMessage(savedMessage, request);

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

    private void dispatchNotificationsForMessage(Message message, MessageRequest request) {
        try {
            UUID senderId = message.getSenderId();
            UserDTO sender = userService.getUserProfile(senderId);
            String senderName = resolveSenderName(sender);
            String preview = buildNotificationPreview(message);

            List<UUID> recipientIds = userConversationRepository.findByConversationId(message.getKey().getConversationId())
                    .stream()
                    .map(userConversation -> userConversation.getKey().getUserId())
                    .filter(recipientId -> !recipientId.equals(senderId))
                    .filter(recipientId -> !hasBlocked(recipientId, senderId))
                    .distinct()
                    .collect(Collectors.toList());

            Set<UUID> mentionedUserIds = request.getMentionedUserIds() == null
                    ? Collections.emptySet()
                    : new LinkedHashSet<>(request.getMentionedUserIds());

            Optional<UUID> replyRecipient = resolveReplyRecipient(message);
            boolean isDirectConversation = recipientIds.size() == 1;

            for (UUID recipientId : recipientIds) {
                if (mentionedUserIds.contains(recipientId)) {
                    notificationService.createMentionNotification(
                            recipientId,
                            senderId,
                            senderName,
                            message.getKey().getConversationId(),
                            message.getKey().getMessageId(),
                            preview);
                    continue;
                }

                if (replyRecipient.isPresent() && replyRecipient.get().equals(recipientId)) {
                    notificationService.createReplyNotification(
                            recipientId,
                            senderId,
                            senderName,
                            message.getKey().getConversationId(),
                            message.getKey().getMessageId(),
                            Objects.requireNonNull(message.getReplyTo()),
                            preview);
                    continue;
                }

                if (isDirectConversation) {
                    notificationService.createMessageNotification(
                            recipientId,
                            message.getKey().getConversationId(),
                            message.getKey().getMessageId(),
                            senderName,
                            preview);
                }
            }
        } catch (Exception notificationError) {
            log.warn("Failed to dispatch notifications for message {}: {}",
                    message.getKey().getMessageId(), notificationError.getMessage());
        }
    }

    private boolean hasBlocked(UUID userId, UUID friendId) {
        return friendshipRepository.findByUserIdAndFriendId(userId, friendId)
                .map(f -> f.getStatus() == Friendship.Status.BLOCKED)
                .orElse(false);
    }

    private Optional<UUID> resolveReplyRecipient(Message message) {
        UUID replyToId = message.getReplyTo();
        if (replyToId == null) {
            return Optional.empty();
        }

        return messageRepository.findByConversationIdAndMessageId(message.getKey().getConversationId(), replyToId)
                .map(Message::getSenderId)
                .filter(replySenderId -> !replySenderId.equals(message.getSenderId()));
    }

    private String resolveSenderName(UserDTO sender) {
        if (sender.getDisplayName() != null && !sender.getDisplayName().isBlank()) {
            return sender.getDisplayName();
        }
        if (sender.getUserName() != null && !sender.getUserName().isBlank()) {
            return sender.getUserName();
        }
        return "Unknown User";
    }

    private String buildNotificationPreview(Message message) {
        if (message.getContent() != null && !message.getContent().isBlank()) {
            return message.getContent();
        }

        List<MessageAttachment> attachments = messageAttachmentRepository.findByConversationIdAndMessageId(
                message.getKey().getConversationId(),
                message.getKey().getMessageId());
        if (!attachments.isEmpty()) {
            List<String> fileNames = attachments.stream()
                    .map(MessageAttachment::getFileName)
                    .filter(Objects::nonNull)
                    .filter(fileName -> !fileName.isBlank())
                    .limit(3)
                    .collect(Collectors.toCollection(ArrayList::new));
            if (!fileNames.isEmpty()) {
                return "Attachment: " + String.join(", ", fileNames);
            }
            return "Sent an attachment";
        }

        return "New message";
    }

    public List<MessageResponseDto> getLatestMessagesAlternative(UUID conversationId, Pageable pageable) {
        UUID userId = securityContextHelper.getCurrentUserId();
        messageValidationService.validateConversationMembership(conversationId, userId);

        List<Message> messages = messageRepository.findByKeyConversationIdOrderByKeyMessageIdDesc(conversationId, pageable);

        return enrichmentService.enrichMessages(conversationId, messages, userId);
    }

    public MessageResponseDto editMessage(UUID conversationId, UUID messageId, String content, UUID editorId) {
        if (content == null || content.trim().isEmpty()) {
            throw new BusinessException("Noi dung tin nhan khong duoc de trong");
        }

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));

        if (!editorId.equals(message.getSenderId())) {
            throw new BusinessException("Chi nguoi gui moi co the sua tin nhan");
        }
        if (message.isDeleted()) {
            throw new BusinessException("Khong the sua tin nhan da xoa");
        }

        createRevision(message, editorId, "EDIT");
        message.setContent(content.trim());
        message.setEditedAt(Instant.now());
        Message saved = messageRepository.save(message);
        syncMessageUpdate(saved);
        return enrichSingle(conversationId, saved, editorId);
    }

    public MessageResponseDto deleteMessage(UUID conversationId, UUID messageId, UUID requesterId) {
        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));

        if (!requesterId.equals(message.getSenderId())) {
            throw new BusinessException("Chi nguoi gui moi co the xoa tin nhan");
        }
        if (message.isDeleted()) {
            return enrichSingle(conversationId, message, requesterId);
        }

        createRevision(message, requesterId, "DELETE");
        message.setDeleted(true);
        message.setEditedAt(Instant.now());
        Message saved = messageRepository.save(message);
        syncMessageUpdate(saved);
        return enrichSingle(conversationId, saved, requesterId);
    }

    public List<MessageRevisionDto> getMessageRevisions(UUID conversationId, UUID messageId, UUID requesterId) {
        messageValidationService.validateConversationMembership(conversationId, requesterId);
        return messageRevisionRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .stream()
                .map(revision -> MessageRevisionDto.builder()
                        .revisionNumber(revision.getKey().getRevisionNumber())
                        .content(revision.getContent())
                        .editedAt(revision.getEditedAt())
                        .editedBy(revision.getEditedBy())
                        .action(revision.getAction())
                        .build())
                .collect(Collectors.toList());
    }

    private void createRevision(Message message, UUID editorId, String action) {
        List<MessageRevision> revisions = messageRevisionRepository.findByConversationIdAndMessageId(
                message.getKey().getConversationId(),
                message.getKey().getMessageId());
        int nextRevision = revisions.stream()
                .map(revision -> revision.getKey().getRevisionNumber())
                .max(Integer::compareTo)
                .orElse(0) + 1;

        MessageRevision revision = MessageRevision.builder()
                .key(new MessageRevision.MessageRevisionKey(
                        message.getKey().getConversationId(),
                        message.getKey().getMessageId(),
                        nextRevision))
                .content(message.getContent())
                .editedAt(Instant.now())
                .editedBy(editorId)
                .action(action)
                .build();
        messageRevisionRepository.save(revision);
    }

    private MessageResponseDto enrichSingle(UUID conversationId, Message message, UUID currentUserId) {
        List<MessageResponseDto> enriched = enrichmentService.enrichMessages(conversationId, List.of(message), currentUserId);
        return enriched.isEmpty() ? messageMapper.toResponseDto(message, currentUserId) : enriched.get(0);
    }

    private void syncMessageUpdate(Message message) {
        if (messageElasticsearchService != null) {
            try {
                messageElasticsearchService.updateMessage(message);
            } catch (Exception e) {
                log.warn("Failed to sync updated message {} to Elasticsearch: {}", message.getKey().getMessageId(), e.getMessage());
            }
        }

        MessageResponseDto payload = enrichSingle(message.getKey().getConversationId(), message, message.getSenderId());
        messagingTemplate.convertAndSend("/topic/conversation/" + message.getKey().getConversationId(), payload);
    }
}