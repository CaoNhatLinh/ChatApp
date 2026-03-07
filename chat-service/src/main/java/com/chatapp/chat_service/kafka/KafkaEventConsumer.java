package com.chatapp.chat_service.kafka;

import com.chatapp.chat_service.conversation.entity.ConversationMembers;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.friendship.event.FriendshipStatusEvent;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.event.MessageEvent;
import com.chatapp.chat_service.message.service.MessageService;
import com.chatapp.chat_service.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class KafkaEventConsumer {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageService messageService;
    private final NotificationService notificationService;
    private final ConversationMemberRepository conversationMemberRepository;

    @KafkaListener(topics = "message-topic", containerFactory = "messagePersistenceListenerFactory")
    public void handleMessagePersistence(@org.springframework.messaging.handler.annotation.Payload MessageEvent event, 
                                        Acknowledgment acknowledgment) {
        log.info("Received Persistence MessageEvent: conversationId={}, senderId={}", 
                event.getConversationId(), event.getSenderId());

        try {
            if (event.getMessageRequest() != null) {
                MessageResponseDto savedMessage = messageService.sendMessage(event.getMessageRequest());
                log.info("Message saved to database: messageId={}", savedMessage.getMessageId());
                
                messagingTemplate.convertAndSend(
                        "/topic/conversation/" + event.getConversationId(),
                        savedMessage
                );
                
                try {
                    var members = conversationMemberRepository
                            .findAllByKeyConversationId(event.getConversationId());
                    for (ConversationMembers member : members) {
                        messagingTemplate.convertAndSend(
                                "/topic/user/" + member.getKey().getUserId() + "/new-message",
                                java.util.Map.of(
                                        "conversationId", event.getConversationId().toString(),
                                        "senderId", event.getSenderId().toString()
                                )
                        );
                    }
                } catch (Exception memberEx) {
                    log.warn("Failed to send per-user new-message notification: {}", memberEx.getMessage());
                }
            }
            acknowledgment.acknowledge(); 
        } catch (Exception e) {
            log.error("Error persisting message, will retry: {}", e.getMessage(), e);
            throw new RuntimeException("Persistence failure", e); 
        }
    }

    @KafkaListener(topics = "message-topic", containerFactory = "messageBroadcastListenerFactory")
    public void handleMessageBroadcast(@org.springframework.messaging.handler.annotation.Payload MessageEvent event, 
                                      Acknowledgment acknowledgment) {
        acknowledgment.acknowledge();
    }


    @KafkaListener(topics = "friendship-status-events", containerFactory = "friendshipPersistenceListenerFactory")
    public void handleFriendshipPersistence(@org.springframework.messaging.handler.annotation.Payload FriendshipStatusEvent event, 
                                            Acknowledgment acknowledgment) {
        log.info("Processing friendship persistence: sender={}, receiver={}, status={}",
                   event.getSenderId(), event.getReceiverId(), event.getStatus());
        
        try {
            if (event.getSenderId() != null && event.getReceiverId() != null) {
                notificationService.createFriendshipNotificationInternal(
                        event.getReceiverId(),
                        event.getSenderId(),
                        event.getStatus()
                );
            }
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("Error persisting friendship notification: {}", e.getMessage());
            throw new RuntimeException("Friendship persistence failure", e);
        }
    }

    @KafkaListener(topics = "friendship-status-events", containerFactory = "friendshipBroadcastListenerFactory")
    public void handleFriendshipBroadcast(@org.springframework.messaging.handler.annotation.Payload FriendshipStatusEvent event, 
                                           Acknowledgment acknowledgment) {
        log.debug("Broadcasting friendship update for receiver: {}", event.getReceiverId());

        try {
            messagingTemplate.convertAndSend("/topic/friendship-updates/" + event.getReceiverId(), event);
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("Error broadcasting friendship update: {}", e.getMessage());
            acknowledgment.acknowledge();
        }
    }

}
