package com.chatapp.chat_service.message.service.forward;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageForward;
import com.chatapp.chat_service.message.entity.MessageMention;
import com.chatapp.chat_service.message.event.MessageEvent;
import com.chatapp.chat_service.message.repository.MessageForwardRepository;
import com.chatapp.chat_service.message.repository.MessageMentionRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.message.service.MessageService;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ForwardService {

    private final MessageForwardRepository forwardRepository;
    private final MessageRepository messageRepository;
    private final MessageService messageService;
    private final MessageMentionRepository mentionRepository;
    private final UserService userService;
    private final KafkaEventProducer kafkaEventProducer;

    /**
     * Forward a message to another conversation
     */
    public MessageResponseDto forwardMessage(UUID originalConversationId, UUID originalMessageId,
                                             UUID targetConversationId, UUID forwardedBy) {
        // Get original message
        Message originalMessage = messageRepository.findByConversationIdAndMessageId(
                originalConversationId, originalMessageId)
                .orElseThrow(() -> new RuntimeException("Original message not found"));

        // Create new message in target conversation
        UUID newMessageId = Uuids.timeBased();
        Message.MessageKey key = new Message.MessageKey(targetConversationId, newMessageId);

        Message forwardedMessage = Message.builder()
                .key(key)
                .senderId(forwardedBy)
                .content(originalMessage.getContent())
                .createdAt(Instant.now())
                .isDeleted(false)
                .type("FORWARDED")
                .replyTo(null)
                .build();

        Message savedMessage = messageRepository.save(forwardedMessage);

        // Record the forward
        MessageForward.MessageForwardKey forwardKey = new MessageForward.MessageForwardKey(
                targetConversationId, newMessageId);

        MessageForward forward = MessageForward.builder()
                .key(forwardKey)
                .forwardedAt(Instant.now())
                .forwardedBy(forwardedBy)
                .originalConversationId(originalConversationId)
                .originalSenderId(originalMessage.getSenderId())
                .build();

        forwardRepository.save(forward);

        // Copy mentions if any
        if (originalMessage.getReplyTo() != null) {
            // Handle reply-to if needed
        }

        // Publish event
        MessageRequest messageRequest = MessageRequest.builder()
                .conversationId(targetConversationId)
                .content(originalMessage.getContent())
                .type("FORWARDED")
                .senderId(forwardedBy)
                .build();

        MessageEvent kafkaEvent = MessageEvent.forKafkaProcessing(messageRequest);
        kafkaEventProducer.sendMessageEvent(kafkaEvent);

        log.info("Message forwarded from {} to {} by user {}", 
                originalConversationId, targetConversationId, forwardedBy);

        return messageService.buildMessageResponse(savedMessage, forwardedBy);
    }

    /**
     * Forward message with custom content
     */
    public MessageResponseDto forwardMessageWithComment(UUID originalConversationId, UUID originalMessageId,
                                                         UUID targetConversationId, UUID forwardedBy,
                                                         String customContent) {
        // Get original message
        Message originalMessage = messageRepository.findByConversationIdAndMessageId(
                originalConversationId, originalMessageId)
                .orElseThrow(() -> new RuntimeException("Original message not found"));

        // Create new message with custom content
        UUID newMessageId = Uuids.timeBased();
        Message.MessageKey key = new Message.MessageKey(targetConversationId, newMessageId);

        String finalContent = customContent != null && !customContent.isEmpty() 
                ? customContent 
                : originalMessage.getContent();

        Message forwardedMessage = Message.builder()
                .key(key)
                .senderId(forwardedBy)
                .content(finalContent)
                .createdAt(Instant.now())
                .isDeleted(false)
                .type("FORWARDED")
                .replyTo(null)
                .build();

        Message savedMessage = messageRepository.save(forwardedMessage);

        // Record the forward
        MessageForward.MessageForwardKey forwardKey = new MessageForward.MessageForwardKey(
                targetConversationId, newMessageId);

        MessageForward forward = MessageForward.builder()
                .key(forwardKey)
                .forwardedAt(Instant.now())
                .forwardedBy(forwardedBy)
                .originalConversationId(originalConversationId)
                .originalSenderId(originalMessage.getSenderId())
                .build();

        forwardRepository.save(forward);

        // Publish event
        MessageRequest messageRequest = MessageRequest.builder()
                .conversationId(targetConversationId)
                .content(finalContent)
                .type("FORWARDED")
                .senderId(forwardedBy)
                .build();

        MessageEvent kafkaEvent = MessageEvent.forKafkaProcessing(messageRequest);
        kafkaEventProducer.sendMessageEvent(kafkaEvent);

        log.info("Message forwarded with comment from {} to {} by user {}", 
                originalConversationId, targetConversationId, forwardedBy);

        return messageService.buildMessageResponse(savedMessage, forwardedBy);
    }

    /**
     * Get forward history for a message
     */
    public java.util.List<MessageForward> getForwardHistory(UUID conversationId, UUID messageId) {
        return forwardRepository.findByConversationIdAndMessageId(conversationId, messageId);
    }

    /**
     * Get all forwards by a user
     */
    public java.util.List<MessageForward> getForwardsByUser(UUID forwardedBy) {
        return forwardRepository.findByForwardedBy(forwardedBy);
    }

    /**
     * Check if a message is forwarded
     */
    public boolean isMessageForwarded(UUID conversationId, UUID messageId) {
        java.util.List<MessageForward> forwards = forwardRepository.findByConversationIdAndMessageId(
                conversationId, messageId);
        return !forwards.isEmpty();
    }
}
