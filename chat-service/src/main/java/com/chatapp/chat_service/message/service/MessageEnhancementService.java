package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.dto.AggregatedReactionDto;
import com.chatapp.chat_service.message.dto.MessageAttachmentDto;
import com.chatapp.chat_service.message.dto.MessageReactionDto;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageAttachment;
import com.chatapp.chat_service.message.entity.MessageReaction;
import com.chatapp.chat_service.message.entity.MessageReadReceipt;
import com.chatapp.chat_service.message.entity.PinnedMessage;
import com.chatapp.chat_service.message.event.MessageReactionEvent;
import com.chatapp.chat_service.message.event.MessageReadEvent;
import com.chatapp.chat_service.message.repository.MessageAttachmentRepository;
import com.chatapp.chat_service.message.repository.MessageReactionRepository;
import com.chatapp.chat_service.message.repository.MessageReadReceiptRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.message.repository.PinnedMessageRepository;
import com.chatapp.chat_service.notification.service.NotificationService;
import com.chatapp.chat_service.common.exception.BusinessException;
import com.chatapp.chat_service.security.SecurityContextHelper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageEnhancementService {

    private static final int MAX_PINNED_MESSAGES = 5;

    private final MessageAttachmentRepository attachmentRepository;
    private final MessageReactionRepository reactionRepository;
    private final MessageReadReceiptRepository readReceiptRepository;
    private final PinnedMessageRepository pinnedMessageRepository;
    private final MessageRepository messageRepository;
    private final NotificationService notificationService;
    private final UserService userService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final KafkaEventProducer kafkaEventProducer;
    private final MessageValidationService validationService;
    private final SecurityContextHelper securityContextHelper;


    /**
     * Thêm attachment vào message
     */
    public MessageAttachmentDto addAttachment(UUID conversationId, UUID messageId, MessageAttachmentDto attachmentDto, UUID userId) {
        validationService.validateConversationMembership(conversationId, userId);
        UUID attachmentId = UUID.randomUUID();
        
        MessageAttachment attachment = MessageAttachment.builder()
                .key(new MessageAttachment.MessageAttachmentKey(conversationId, messageId, attachmentId))
                .attachmentType(attachmentDto.getAttachmentType())
                .fileName(attachmentDto.getFileName())
                .url(attachmentDto.getUrl())
                .fileSize(attachmentDto.getFileSize())
                .mimeType(attachmentDto.getMimeType())
                .build();

        attachmentRepository.save(attachment);

        String cacheKey = "message_attachments:" + conversationId + ":" + messageId;
        redisTemplate.delete(cacheKey);

        log.info("Added attachment {} to message {} in conversation {}", attachmentId, messageId, conversationId);

        MessageAttachmentDto result = MessageAttachmentDto.builder()
                .attachmentId(attachmentId)
                .attachmentType(attachment.getAttachmentType())
                .fileName(attachment.getFileName())
                .url(attachment.getUrl())
                .fileSize(attachment.getFileSize())
                .mimeType(attachment.getMimeType())
                .build();

        Map<String, Object> attachmentEvent = Map.of(
            "action", "ADD",
            "conversationId", conversationId,
            "messageId", messageId,
            "attachment", result
        );

        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId + "/attachments", attachmentEvent);
        kafkaEventProducer.sendAttachmentEvent(attachmentEvent);

        return result;
    }

    /**
     * Lấy attachments của message
     */
    public List<MessageAttachmentDto> getMessageAttachments(UUID conversationId, UUID messageId, UUID userId) {
        validationService.validateConversationMembership(conversationId, userId);
        String cacheKey = "message_attachments:" + conversationId + ":" + messageId;
        
        List<Object> cachedAttachments = redisTemplate.opsForList().range(cacheKey, 0, -1);
        if (cachedAttachments != null && !cachedAttachments.isEmpty()) {
            return cachedAttachments.stream()
                    .map(obj -> (MessageAttachment) obj)
                    .map(this::mapToAttachmentDto)
                    .collect(Collectors.toList());
        }

        List<MessageAttachment> attachments = attachmentRepository.findByConversationIdAndMessageId(conversationId, messageId);
        
        if (!attachments.isEmpty()) {
            attachments.forEach(attachment -> 
                redisTemplate.opsForList().rightPush(cacheKey, attachment));
            redisTemplate.expire(cacheKey, Duration.ofHours(1));
        }

        return attachments.stream()
                .map(this::mapToAttachmentDto)
                .collect(Collectors.toList());
    }

    /**
     * Lấy attachments cho nhiều messages (Batch fetch)
     */
    public Map<UUID, List<MessageAttachmentDto>> getAttachmentsForMessages(UUID conversationId, List<UUID> messageIds) {
        if (messageIds == null || messageIds.isEmpty()) return Collections.emptyMap();
        
        List<MessageAttachment> allAttachments = attachmentRepository.findByConversationIdAndMessageIdIn(conversationId, messageIds);
        
        return allAttachments.stream()
                .collect(Collectors.groupingBy(
                        a -> a.getKey().getMessageId(),
                        Collectors.mapping(this::mapToAttachmentDto, Collectors.toList())
                ));
    }


    /**
     * Thêm hoặc xóa reaction
     */
    public void toggleReaction(UUID conversationId, UUID messageId, String emoji, UUID userId) {
        validationService.validateConversationMembership(conversationId, userId);
        MessageReaction.MessageReactionKey key = new MessageReaction.MessageReactionKey(conversationId, messageId, emoji, userId);
        
        Optional<MessageReaction> existingReaction = reactionRepository.findById(key);
        boolean isRemoving = existingReaction.isPresent();
        
        if (isRemoving) {
            reactionRepository.delete(existingReaction.get());
            log.info("Removed reaction {} from user {} on message {}", emoji, userId, messageId);
        } else {
            MessageReaction reaction = MessageReaction.builder()
                    .key(key)
                    .reactedAt(Instant.now())
                    .build();
            reactionRepository.save(reaction);
            log.info("Added reaction {} from user {} on message {}", emoji, userId, messageId);
        }

        clearReactionCache(conversationId, messageId);

        MessageReactionEvent event = MessageReactionEvent.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .emoji(emoji)
                .userId(userId)
                .action(isRemoving ? "REMOVE" : "ADD")
                .timestamp(Instant.now())
                .build();

        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId + "/reactions", event);
        kafkaEventProducer.sendReactionEvent(event);

        UUID messageOwnerId = getMessageOwnerId(conversationId, messageId);
        if (!isRemoving && messageOwnerId != null && !userId.equals(messageOwnerId)) {
            try {
                String userName = getUserName(userId);
                notificationService.createReactionNotification(messageOwnerId, userId, userName, emoji, conversationId, messageId);
            } catch (Exception e) {
                log.warn("Failed to create reaction notification for message {}: {}", messageId, e.getMessage());
            }
        }
    }

    /**
     * Get message owner ID
     */
    private UUID getMessageOwnerId(UUID conversationId, UUID messageId) {
        Message.MessageKey key = new Message.MessageKey(conversationId, messageId);
        Optional<Message> message = messageRepository.findById(key);
        return message.map(Message::getSenderId).orElse(null);
    }

    /**
     * Get user name (simplified implementation)
     */
    private String getUserName(UUID userId) {
        return "User-" + userId.toString().substring(0, 8);
    }

    /**
     * Lấy reactions của message
     */
    public List<AggregatedReactionDto> getMessageReactions(UUID conversationId, UUID messageId, UUID currentUserId) {
        validationService.validateConversationMembership(conversationId, currentUserId);
        String cacheKey = "message_reactions:" + conversationId + ":" + messageId;
        Map<Object, Object> cachedReactions = redisTemplate.opsForHash().entries(cacheKey);
        if (!cachedReactions.isEmpty()) {
            return buildAggregatedReactionDtos(cachedReactions, currentUserId);
        }
        List<MessageReaction> reactions = reactionRepository.findByConversationIdAndMessageId(conversationId, messageId);
        Map<String, List<MessageReaction>> groupedReactions = reactions.stream()
                .collect(Collectors.groupingBy(r -> r.getKey().getEmoji()));
        Set<UUID> allUserIds = reactions.stream()
                .map(r -> r.getKey().getUserId())
                .collect(Collectors.toSet());
        Map<UUID, UserDTO> userMap = userService.getUserDetailsMap(allUserIds);
        List<AggregatedReactionDto> resultDtos = new ArrayList<>();
        groupedReactions.forEach((emoji, reactionList) -> {
            List<UUID> userIds = reactionList.stream().map(r -> r.getKey().getUserId()).collect(Collectors.toList());
            Instant lastReactedAt = reactionList.stream().map(MessageReaction::getReactedAt).max(Instant::compareTo).orElse(Instant.now());
            Map<String, Object> emojiData = new HashMap<>();
            emojiData.put("userIds", userIds);
            emojiData.put("count", reactionList.size());
            emojiData.put("lastReactedAt", lastReactedAt);
            
            redisTemplate.opsForHash().put(cacheKey, emoji, emojiData);
            AggregatedReactionDto dto = AggregatedReactionDto.builder()
                    .emoji(emoji)
                    .count(reactionList.size())
                    .reactedByCurrentUser(userIds.contains(currentUserId))
                    .latestUsers(userIds.stream()
                            .limit(3)
                            .map(userMap::get)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList()))
                    .build();
            resultDtos.add(dto);
        });
        redisTemplate.expire(cacheKey, Duration.ofMinutes(30));
        return resultDtos;
    }

    /**
     * Lấy reactions cho nhiều messages (Batch fetch)
     */
    public Map<UUID, List<AggregatedReactionDto>> getReactionsForMessages(UUID conversationId, List<UUID> messageIds, UUID currentUserId) {
        validationService.validateConversationMembership(conversationId, currentUserId);
        if (messageIds == null || messageIds.isEmpty()) return Collections.emptyMap();

        List<MessageReaction> allReactions = reactionRepository.findByConversationIdAndMessageIdIn(conversationId, messageIds);
        
        Map<UUID, List<MessageReaction>> reactionsByMessage = allReactions.stream()
                .collect(Collectors.groupingBy(r -> r.getKey().getMessageId()));

        Set<UUID> allUserIds = allReactions.stream()
                .map(r -> r.getKey().getUserId())
                .collect(Collectors.toSet());
        Map<UUID, UserDTO> userDetailsMap = userService.getUserDetailsMap(allUserIds);

        Map<UUID, List<AggregatedReactionDto>> result = new HashMap<>();
        reactionsByMessage.forEach((messageId, reactions) -> {
            Map<String, List<MessageReaction>> reactionsByEmoji = reactions.stream()
                    .collect(Collectors.groupingBy(r -> r.getKey().getEmoji()));

            List<AggregatedReactionDto> aggregated = reactionsByEmoji.entrySet().stream()
                    .map(entry -> {
                        String emoji = entry.getKey();
                        List<MessageReaction> list = entry.getValue();
                        List<UUID> reactUserIds = list.stream().map(r -> r.getKey().getUserId()).collect(Collectors.toList());
                        
                        return AggregatedReactionDto.builder()
                                .emoji(emoji)
                                .count(list.size())
                                .reactedByCurrentUser(reactUserIds.contains(currentUserId))
                                .latestUsers(reactUserIds.stream()
                                        .limit(3)
                                        .map(userDetailsMap::get)
                                        .filter(Objects::nonNull)
                                        .collect(Collectors.toList()))
                                .build();
                    })
                    .collect(Collectors.toList());
            
            result.put(messageId, aggregated);
        });

        return result;
    }


    /**
     * Đánh dấu message đã đọc
     */
    public void markAsRead(UUID conversationId, UUID messageId, UUID readerId) {
        validationService.validateConversationMembership(conversationId, readerId);
        MessageReadReceipt.MessageReadReceiptKey key = new MessageReadReceipt.MessageReadReceiptKey(conversationId, messageId, readerId);
        
        Optional<MessageReadReceipt> existing = readReceiptRepository.findById(key);
        if (existing.isPresent()) {
            return; 
        }

        MessageReadReceipt receipt = MessageReadReceipt.builder()
                .key(key)
                .readAt(Instant.now())
                .build();

        readReceiptRepository.save(receipt);

        String cacheKey = "message_read_receipts:" + conversationId + ":" + messageId;
        redisTemplate.delete(cacheKey);

        MessageReadEvent event = MessageReadEvent.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .readerId(readerId)
                .readAt(Instant.now())
                .build();

        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId + "/read", event);
        kafkaEventProducer.sendReadReceiptEvent(event);

        log.info("User {} marked message {} as read in conversation {}", readerId, messageId, conversationId);
    }

    /**
     * Lấy read receipts cho message
     */
    public List<MessageReadReceipt> getMessageReadReceipts(UUID conversationId, UUID messageId, UUID userId) {
        validationService.validateConversationMembership(conversationId, userId);
        String cacheKey = "message_read_receipts:" + conversationId + ":" + messageId;
        
        List<Object> cachedReceipts = redisTemplate.opsForList().range(cacheKey, 0, -1);
        if (cachedReceipts != null && !cachedReceipts.isEmpty()) {
            return cachedReceipts.stream()
                    .map(obj -> (MessageReadReceipt) obj)
                    .collect(Collectors.toList());
        }

        List<MessageReadReceipt> receipts = readReceiptRepository.findByConversationIdAndMessageId(conversationId, messageId);
        
        if (!receipts.isEmpty()) {
            receipts.forEach(receipt -> 
                redisTemplate.opsForList().rightPush(cacheKey, receipt));
            redisTemplate.expire(cacheKey, Duration.ofMinutes(15));
        }

        return receipts;
    }


    /**
     * Pin/Unpin message
     */
    public void togglePinMessage(UUID conversationId, UUID messageId, UUID pinnedBy) {
        validationService.validateConversationMembership(conversationId, pinnedBy);
        PinnedMessage.PinnedMessageKey key = new PinnedMessage.PinnedMessageKey(conversationId, messageId);
        
        Optional<PinnedMessage> existing = pinnedMessageRepository.findById(key);
        
        if (existing.isPresent()) {
            pinnedMessageRepository.delete(existing.get());
            log.info("Unpinned message {} in conversation {} by user {}", messageId, conversationId, pinnedBy);
        } else {
            if (pinnedMessageRepository.countByConversationId(conversationId) >= MAX_PINNED_MESSAGES) {
                throw new BusinessException("Chi duoc ghim toi da 5 tin nhan trong mot hoi thoai");
            }
            PinnedMessage pinnedMessage = PinnedMessage.builder()
                    .key(key)
                    .pinnedAt(Instant.now())
                    .pinnedBy(pinnedBy)
                    .build();
            pinnedMessageRepository.save(pinnedMessage);
            log.info("Pinned message {} in conversation {} by user {}", messageId, conversationId, pinnedBy);
        }

        String cacheKey = "pinned_messages:" + conversationId;
        redisTemplate.delete(cacheKey);

        Map<String, Object> pinEvent = Map.of(
            "messageId", messageId, 
            "conversationId", conversationId,
            "action", existing.isPresent() ? "UNPIN" : "PIN", 
            "pinnedBy", pinnedBy
        );

        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId + "/pins", pinEvent);
        kafkaEventProducer.sendPinEvent(pinEvent);
    }

    /**
     * Lấy pinned messages
     */
    public List<PinnedMessage> getPinnedMessages(UUID conversationId, UUID userId) {
        validationService.validateConversationMembership(conversationId, userId);
        String cacheKey = "pinned_messages:" + conversationId;
        
        List<Object> cachedPinned = redisTemplate.opsForList().range(cacheKey, 0, -1);
        if (cachedPinned != null && !cachedPinned.isEmpty()) {
            return cachedPinned.stream()
                    .map(obj -> (PinnedMessage) obj)
                    .collect(Collectors.toList());
        }

        List<PinnedMessage> pinnedMessages = pinnedMessageRepository.findByConversationId(conversationId);
        
        if (!pinnedMessages.isEmpty()) {
            pinnedMessages.forEach(pinned -> 
                redisTemplate.opsForList().rightPush(cacheKey, pinned));
            redisTemplate.expire(cacheKey, Duration.ofMinutes(30));
        }

        return pinnedMessages;
    }


    private MessageAttachmentDto mapToAttachmentDto(MessageAttachment attachment) {
        return MessageAttachmentDto.builder()
                .attachmentId(attachment.getKey().getAttachmentId())
                .attachmentType(attachment.getAttachmentType())
                .fileName(attachment.getFileName())
                .url(attachment.getUrl())
                .fileSize(attachment.getFileSize())
                .mimeType(attachment.getMimeType())
                .build();
    }

    private List<AggregatedReactionDto> buildAggregatedReactionDtos(Map<Object, Object> cachedReactions, UUID currentUserId) {
        Set<UUID> allUserIds = cachedReactions.values().stream()
                .flatMap(data -> {
                    if (!(data instanceof Map<?, ?> dataMap)) {
                        return java.util.stream.Stream.<UUID>empty();
                    }
                    Object userIdsObj = dataMap.get("userIds");
                    if (userIdsObj instanceof List<?> userIdsList) {
                        return userIdsList.stream()
                                .map(id -> {
                                    if (id instanceof UUID uid) return uid;
                                    if (id instanceof String sid) return UUID.fromString(sid);
                                    return null;
                                })
                                .filter(Objects::nonNull);
                    }
                    return java.util.stream.Stream.<UUID>empty();
                })
                .collect(Collectors.toSet());

        Map<UUID, UserDTO> userMap = userService.getUserDetailsMap(allUserIds);

        return cachedReactions.entrySet().stream()
                .map(entry -> {
                    String emoji = (String) entry.getKey();
                    if (!(entry.getValue() instanceof Map<?, ?> rawData)) {
                        return AggregatedReactionDto.builder()
                                .emoji(emoji).count(0L).reactedByCurrentUser(false)
                                .latestUsers(Collections.emptyList()).build();
                    }
                    List<UUID> userIds = new ArrayList<>();
                    Object userIdsObj = rawData.get("userIds");
                    if (userIdsObj instanceof List<?> rawList) {
                        for (Object id : rawList) {
                            if (id instanceof UUID uid) userIds.add(uid);
                            else if (id instanceof String sid) userIds.add(UUID.fromString(sid));
                        }
                    }
                    Number countNumber = (Number) rawData.get("count");
                    long count = countNumber != null ? countNumber.longValue() : 0;
                    return AggregatedReactionDto.builder()
                            .emoji(emoji)
                            .count(count)
                            .reactedByCurrentUser(userIds.contains(currentUserId))
                            .latestUsers(userIds.stream()
                                    .limit(3)
                                    .map(userMap::get)
                                    .filter(Objects::nonNull)
                                    .collect(Collectors.toList()))
                            .build();
                })
                .collect(Collectors.toList());
    }
    private void clearReactionCache(UUID conversationId, UUID messageId) {
        String cacheKey = "message_reactions:" + conversationId + ":" + messageId;
        redisTemplate.delete(cacheKey);
    }
}
