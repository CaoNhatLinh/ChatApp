package com.chatapp.chat_service.friendship.event;

import com.chatapp.chat_service.friendship.dto.FriendRequestNotification;
import com.chatapp.chat_service.friendship.dto.FriendRequestUpdate;
import com.chatapp.chat_service.friendship.entity.Friendship;
import com.chatapp.chat_service.kafka.KafkaEventProducer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Listener that reacts to FriendshipEvents and dispatches
 * Kafka messages + WebSocket notifications.
 * Keeps messaging concerns out of the core FriendService.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FriendshipEventListener {

    private final KafkaEventProducer kafkaEventProducer;
    private final SimpMessagingTemplate messagingTemplate;

    @Async
    @EventListener
    public void handleFriendshipEvent(FriendshipEvent event) {
        log.info("Handling FriendshipEvent: type={}, sender={}, receiver={}",
                event.getType(), event.getSenderId(), event.getReceiverId());

        switch (event.getType()) {
            case FRIEND_REQUEST_SENT -> handleRequestSent(event);
            case FRIEND_REQUEST_ACCEPTED -> handleAccepted(event);
            case FRIEND_REQUEST_REJECTED -> handleRejected(event);
            case UNFRIENDED -> handleUnfriended(event);
            case BLOCKED -> handleBlocked(event);
            case UNBLOCKED -> handleUnblocked(event);
        }
    }

    private void handleRequestSent(FriendshipEvent event) {
        kafkaEventProducer.sendFriendRequestEvent(event.getSenderId(), event.getReceiverId());

        FriendRequestNotification notification = new FriendRequestNotification(
                event.getSenderId(), event.getReceiverId());
        if (event.getSenderDisplayName() != null) {
            notification.setMessage(String.format("%s sent you a friend request",
                    event.getSenderDisplayName()));
        }
        messagingTemplate.convertAndSendToUser(
                event.getReceiverId().toString(),
                "/queue/friend-requests",
                notification
        );
    }

    private void handleAccepted(FriendshipEvent event) {
        kafkaEventProducer.sendFriendshipStatusEvent(
                new FriendshipStatusEvent(event.getSenderId(), event.getReceiverId(),
                        Friendship.Status.ACCEPTED));
        messagingTemplate.convertAndSendToUser(
                event.getSenderId().toString(),
                "/queue/friend-requests",
                new FriendRequestUpdate(event.getReceiverId(), "ACCEPTED")
        );
    }

    private void handleRejected(FriendshipEvent event) {
        kafkaEventProducer.sendFriendshipStatusEvent(
                new FriendshipStatusEvent(event.getSenderId(), event.getReceiverId(),
                        Friendship.Status.REJECTED));
        messagingTemplate.convertAndSendToUser(
                event.getSenderId().toString(),
                "/queue/friend-requests",
                new FriendRequestUpdate(event.getReceiverId(), "REJECTED")
        );
    }

    private void handleUnfriended(FriendshipEvent event) {
        kafkaEventProducer.sendFriendshipStatusEvent(
                new FriendshipStatusEvent(event.getSenderId(), event.getReceiverId(),
                        Friendship.Status.REJECTED));
        messagingTemplate.convertAndSendToUser(
                event.getReceiverId().toString(),
                "/queue/friend-requests",
                new FriendRequestUpdate(event.getSenderId(), "UNFRIENDED")
        );
    }

    private void handleBlocked(FriendshipEvent event) {
        kafkaEventProducer.sendFriendshipStatusEvent(
                new FriendshipStatusEvent(event.getSenderId(), event.getReceiverId(),
                        Friendship.Status.BLOCKED));
        messagingTemplate.convertAndSendToUser(
                event.getSenderId().toString(),
                "/queue/friend-requests",
                new FriendRequestUpdate(event.getReceiverId(), "BLOCKED")
        );
    }

    private void handleUnblocked(FriendshipEvent event) {
        messagingTemplate.convertAndSendToUser(
                event.getSenderId().toString(),
                "/queue/friend-requests",
                new FriendRequestUpdate(event.getReceiverId(), "UNBLOCKED")
        );
    }
}
