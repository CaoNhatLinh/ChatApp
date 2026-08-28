package com.chatapp.chat_service.canonical.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class FriendRequestNotificationService {
    private static final Logger log = LoggerFactory.getLogger(FriendRequestNotificationService.class);
    private static final String QUEUE_DESTINATION = "/queue/friend-requests";

    private final SimpMessagingTemplate messagingTemplate;

    public FriendRequestNotificationService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendFriendRequestSent(UUID recipientId, UUID senderId, UUID requestId) {
        sendRecipientUpdate(recipientId, "PENDING", senderId, requestId);
    }

    public void sendFriendRequestAccepted(UUID senderId, UUID accepterId, UUID requestId) {
        sendRecipientUpdate(senderId, "ACCEPTED", accepterId, requestId);
    }

    private void sendRecipientUpdate(UUID targetUserId, String status, UUID actorId, UUID requestId) {
        if (targetUserId == null || actorId == null) {
            return;
        }

        FriendRequestRealtimePayload payload = new FriendRequestRealtimePayload(
                status,
                actorId.toString(),
                targetUserId.toString(),
                requestId == null ? null : requestId.toString(),
                Instant.now().toString()
        );
        try {
            messagingTemplate.convertAndSendToUser(
                    targetUserId.toString(),
                    QUEUE_DESTINATION,
                    payload
            );
        } catch (Exception exception) {
            log.error("Failed to send friend request realtime notification to user {}", targetUserId, exception);
        }
    }

    public static record FriendRequestRealtimePayload(
            String status,
            String actorId,
            String targetUserId,
            String requestId,
            String sentAt
    ) {
    }
}
