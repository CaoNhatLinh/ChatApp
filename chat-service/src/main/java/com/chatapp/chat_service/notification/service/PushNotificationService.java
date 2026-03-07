package com.chatapp.chat_service.notification.service;

import com.chatapp.chat_service.notification.dto.NotificationDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Push notifications via WebSocket.
 * Uses SimpMessagingTemplate to send directly to the user's personal queue.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PushNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public void sendPushNotification(NotificationDto notification) {
        if (notification == null || notification.getUserId() == null) {
            log.warn("Cannot send push notification: null notification or userId");
            return;
        }

        String userId = notification.getUserId().toString();
        messagingTemplate.convertAndSendToUser(
                userId,
                "/queue/notifications",
                notification
        );
        log.debug("Push notification sent to user {}: type={}", userId, notification.getType());
    }
}