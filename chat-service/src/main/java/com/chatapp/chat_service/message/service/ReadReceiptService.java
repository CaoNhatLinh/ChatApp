package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageReadReceipt;
import com.chatapp.chat_service.message.event.MessageReadEvent;
import com.chatapp.chat_service.message.repository.MessageReadReceiptRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReadReceiptService {

    private final MessageReadReceiptRepository readReceiptRepository;
    private final MessageRepository messageRepository;
    private final MessageValidationService messageValidationService;
    private final UserService userService;
    private final KafkaEventProducer kafkaEventProducer;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Mark a message as read by the current user
     */
    @Transactional
    public void markAsRead(UUID conversationId, UUID messageId, UUID readerId) {
        // Check if user is member of conversation
        messageValidationService.validateMessagePermission(conversationId, readerId);

        // Check if message exists
        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new BadRequestException("Message not found"));

        // Don't mark own messages as read
        if (message.getSenderId().equals(readerId)) {
            return;
        }

        // Check if already read
        List<MessageReadReceipt> existingReceipts = readReceiptRepository
                .findByConversationIdAndMessageId(conversationId, messageId);

        boolean alreadyRead = existingReceipts.stream()
                .anyMatch(r -> r.getKey().getReaderId().equals(readerId));

        if (alreadyRead) {
            return;
        }

        // Create read receipt
        MessageReadReceipt.MessageReadReceiptKey key = new MessageReadReceipt.MessageReadReceiptKey(
                conversationId, messageId, readerId);

        MessageReadReceipt receipt = MessageReadReceipt.builder()
                .key(key)
                .readAt(Instant.now())
                .build();

        readReceiptRepository.save(receipt);

        // Publish event
        MessageReadEvent event = MessageReadEvent.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .readerId(readerId)
                .readAt(Instant.now())
                .build();

        kafkaEventProducer.publishMessageReadEvent(event);

        log.info("User {} marked message {} in conversation {} as read", readerId, messageId, conversationId);
    }

    /**
     * Mark multiple messages as read (batch)
     */
    @Transactional
    public void markMultipleAsRead(UUID conversationId, List<UUID> messageIds, UUID readerId) {
        // Check if user is member of conversation
        messageValidationService.validateMessagePermission(conversationId, readerId);

        List<MessageReadReceipt> receiptsToSave = new ArrayList();

        for (UUID messageId : messageIds) {
            // Check if message exists
            Optional<Message> messageOpt = messageRepository.findByConversationIdAndMessageId(conversationId, messageId);
            if (messageOpt.isEmpty()) {
                continue;
            }

            Message message = messageOpt.get();

            // Don't mark own messages as read
            if (message.getSenderId().equals(readerId)) {
                continue;
            }

            // Check if already read
            List<MessageReadReceipt> existingReceipts = readReceiptRepository
                    .findByConversationIdAndMessageId(conversationId, messageId);

            boolean alreadyRead = existingReceipts.stream()
                    .anyMatch(r -> r.getKey().getReaderId().equals(readerId));

            if (alreadyRead) {
                continue;
            }

            // Create read receipt
            MessageReadReceipt.MessageReadReceiptKey key = new MessageReadReceipt.MessageReadReceiptKey(
                    conversationId, messageId, readerId);

            MessageReadReceipt receipt = MessageReadReceipt.builder()
                    .key(key)
                    .readAt(Instant.now())
                    .build();

            receiptsToSave.add(receipt);

            // Publish event
            MessageReadEvent event = MessageReadEvent.builder()
                    .conversationId(conversationId)
                    .messageId(messageId)
                    .readerId(readerId)
                    .readAt(Instant.now())
                    .build();

            kafkaEventProducer.publishMessageReadEvent(event);
        }

        if (!receiptsToSave.isEmpty()) {
            readReceiptRepository.saveAll(receiptsToSave);
            log.info("User {} marked {} messages in conversation {} as read", readerId, receiptsToSave.size(), conversationId);
        }
    }

    /**
     * Get read receipts for a message
     */
    public List<UserDTO> getMessageReadReceipts(UUID conversationId, UUID messageId) {
        // Check if user is member of conversation
        UUID currentUserId = securityContextHelper.getCurrentUserId();
        if (currentUserId != null) {
            messageValidationService.validateMessagePermission(conversationId, currentUserId);
        }

        List<MessageReadReceipt> receipts = readReceiptRepository
                .findByConversationIdAndMessageId(conversationId, messageId);

        return receipts.stream()
                .map(receipt -> userService.getUserProfile(receipt.getKey().getReaderId()))
                .collect(Collectors.toList());
    }

    /**
     * Get read status for multiple messages (batch)
     */
    public Map<UUID, ReadStatus> getReadStatusForMessages(UUID conversationId, List<UUID> messageIds, UUID currentUserId) {
        List<MessageReadReceipt> receipts = readReceiptRepository
                .findByConversationIdAndMessageIdIn(conversationId, messageIds);

        Map<UUID, List<MessageReadReceipt>> receiptsByMessage = receipts.stream()
                .collect(Collectors.groupingBy(r -> r.getKey().getMessageId()));

        Map<UUID, ReadStatus> result = new HashMap<>();

        for (UUID messageId : messageIds) {
            List<MessageReadReceipt> messageReceipts = receiptsByMessage.getOrDefault(messageId, Collections.emptyList());

            boolean readByCurrentUser = messageReceipts.stream()
                    .anyMatch(r -> r.getKey().getReaderId().equals(currentUserId));

            int readCount = messageReceipts.size();

            result.put(messageId, new ReadStatus(readByCurrentUser, readCount));
        }

        return result;
    }

    /**
     * Get unread message count for a conversation
     */
    public long getUnreadCount(UUID conversationId, UUID userId) {
        messageValidationService.validateMessagePermission(conversationId, userId);

        List<UUID> readMessageIds = readReceiptRepository.findByConversationIdAndReaderId(conversationId, userId).stream()
                .map(receipt -> receipt.getKey().getMessageId())
                .collect(Collectors.toList());

        Set<UUID> readSet = new HashSet<>(readMessageIds);

        return messageRepository.findAllByConversationId(conversationId).stream()
                .filter(message -> !message.isDeleted())
                .filter(message -> !userId.equals(message.getSenderId()))
                .filter(message -> !readSet.contains(message.getKey().getMessageId()))
                .count();
    }

    public static class ReadStatus {
        private final boolean readByCurrentUser;
        private final int readCount;

        public ReadStatus(boolean readByCurrentUser, int readCount) {
            this.readByCurrentUser = readByCurrentUser;
            this.readCount = readCount;
        }

        public boolean isReadByCurrentUser() {
            return readByCurrentUser;
        }

        public int getReadCount() {
            return readCount;
        }
    }
}
