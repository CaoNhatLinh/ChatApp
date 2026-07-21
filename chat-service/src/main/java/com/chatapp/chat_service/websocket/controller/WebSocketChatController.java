package com.chatapp.chat_service.websocket.controller;


import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.conversation.service.ConversationMemberService;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.event.MessageEvent;
import com.chatapp.chat_service.message.service.MessageValidationService;
import com.chatapp.chat_service.notification.service.NotificationService;
import com.chatapp.chat_service.presence.dto.OnlineStatusRequest;
import com.chatapp.chat_service.presence.dto.UserPresenceResponse;
import com.chatapp.chat_service.presence.event.OnlineStatusEvent;
import com.chatapp.chat_service.presence.metrics.PresenceFlowMetrics;
import com.chatapp.chat_service.presence.service.PresenceService;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.chatapp.chat_service.websocket.event.TypingEvent;
import com.chatapp.chat_service.websocket.service.TypingIndicatorService;
import com.chatapp.chat_service.websocket.service.WebSocketConnectionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.Objects;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final KafkaEventProducer kafkaEventProducer;
    private final UserService userService;
    private final PresenceService presenceService;
    private final WebSocketConnectionService webSocketConnectionService;
    private final NotificationService notificationService;
    private final JwtTokenProvider jwtTokenProvider;
    private final TypingIndicatorService typingIndicatorService;
    private final ConversationMemberService conversationMemberService;
    private final MessageValidationService messageValidationService;
    private final PresenceFlowMetrics presenceFlowMetrics;

@MessageMapping("/message.send")
    public void handleNewMessage(@Payload MessageEvent event, 
                                Principal principal,
                                @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID senderId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            UUID conversationId = event.getPayload().getConversationId();
            
            messageValidationService.validateMessagePermission(conversationId, senderId);
            
            log.info("Processing message from user: {} to conversation: {}", 
                    senderId, conversationId);

            MessageRequest messageRequest = MessageRequest.builder()
                .conversationId(event.getPayload().getConversationId())
                .content(event.getPayload().getContent())
                .type(event.getPayload().getType())
                .mentionedUserIds(event.getPayload().getMentions())
                .replyTo(event.getPayload().getReplyTo())
                .senderId(senderId)
                .build();

            MessageEvent kafkaEvent = MessageEvent.forKafkaProcessing(messageRequest);
            kafkaEventProducer.sendMessageEvent(kafkaEvent);
            
            log.info("Message sent to Kafka for processing: messageId will be generated on save");

        } catch (Exception e) {
            log.error("Error handling message: {}", e.getMessage(), e);
            sendErrorToUser(principal, authHeader, "Failed to send message: " + e.getMessage());
        }
    }

    @MessageMapping("/message.file")
    public void handleFileMessage(@Payload MessageEvent event, 
                                 Principal principal,
                                 @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID senderId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            UUID conversationId = event.getPayload().getConversationId();
            
            messageValidationService.validateMessagePermission(conversationId, senderId);
            
            log.info("Processing file message from user: {}", senderId);

            MessageRequest messageRequest = MessageRequest.builder()
                .conversationId(event.getPayload().getConversationId())
                .content(event.getPayload().getContent())
                .type(event.getPayload().getType())
                .mentionedUserIds(event.getPayload().getMentions())
                .replyTo(event.getPayload().getReplyTo())
                .senderId(senderId)
                .attachments(event.getPayload().getAttachments())
                .build();

            MessageEvent kafkaEvent = MessageEvent.forKafkaProcessing(messageRequest);
            kafkaEventProducer.sendMessageEvent(kafkaEvent);
            
            log.info("File message sent to Kafka for processing");

        } catch (Exception e) {
            log.error("Error handling file message: {}", e.getMessage(), e);
            sendErrorToUser(principal, authHeader, "Failed to send file message: " + e.getMessage());
        }
    }

    @MessageMapping("/typing")
    public void handleTyping(@Payload TypingEvent event, 
                            Principal principal,
                            @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            
            // Validate membership and blocks before processing typing status
            messageValidationService.validateMessagePermission(event.getConversationId(), userId);
            
            if (event.isTyping()) {
                typingIndicatorService.startTyping(event.getConversationId(), userId);
            } else {
                typingIndicatorService.stopTyping(event.getConversationId(), userId);
            }
            
            if (event.getUser() == null || event.getUser().getUserId() == null) {
                UserDTO userDto = userService.getUserById(userId);
                if (userDto != null) {
                    event.setUser(userDto);
                } else {
                    event.setUser(UserDTO.builder()
                            .userId(userId)
                            .userName("Unknown")
                            .displayName("Unknown")
                            .build());
                }
            }
            
            log.info("User typing status: {} in conversation: {} (typing={}). Broadcasting via Redis Pub/Sub.", 
                    userId, event.getConversationId(), event.isTyping());
            
            typingIndicatorService.broadcastTypingEvent(event);
            
        } catch (Exception e) {
            log.error("Error handling typing event: {}", e.getMessage(), e);
        }
    }



    @MessageMapping("/notification.read")
    public void handleNotificationRead(@Payload Map<String, Object> request, 
                                      Principal principal,
                                      @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            UUID notificationId = UUID.fromString((String) request.get("notificationId"));

            notificationService.markAsRead(userId, notificationId);
        } catch (Exception e) {
            log.error("Error handling notification read: {}", e.getMessage(), e);
        }
    }

    @MessageMapping("/notifications.read-all")
    public void handleMarkAllNotificationsRead(Principal principal,
                                              @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            notificationService.markAllAsRead(userId);
        } catch (Exception e) {
            log.error("Error handling mark all notifications read: {}", e.getMessage(), e);
        }
    }    
    /**
     * BACKUP: Extract user ID from JWT token when Principal fails
     */
    private UUID extractUserIdFromJwtToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        
        try {
            String token = authHeader.substring(7); 
            if (jwtTokenProvider.isTokenValid(token)) {
                UUID userId = jwtTokenProvider.extractUserId(token);
                log.debug("Successfully extracted userId from JWT backup: {}", userId);
                return userId;
            }
        } catch (Exception e) {
            log.warn("Failed to extract userId from JWT token: {}", e.getMessage());
        }
        
        return null;
    }

    /**
     * Extract user ID with multiple fallback strategies
     */
    private UUID extractUserIdFromPrincipalOrToken(Principal principal, String authHeader) {
        if (principal != null) {
            if (principal instanceof com.chatapp.chat_service.security.core.AppUserPrincipal appUser) {
                return appUser.getUserId();
            }

            if (principal instanceof org.springframework.security.core.Authentication auth) {
                Object innerPrincipal = auth.getPrincipal();
                if (innerPrincipal instanceof com.chatapp.chat_service.security.core.AppUserPrincipal appUser) {
                    return appUser.getUserId();
                }
                if (innerPrincipal instanceof String str) {
                    try {
                        return UUID.fromString(str);
                    } catch (IllegalArgumentException ignored) {}
                }
            }

            if (principal.getName() != null) {
                try {
                    return UUID.fromString(principal.getName());
                } catch (IllegalArgumentException ignored) {}
            }
        }

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            UUID userId = jwtTokenProvider.extractUserId(token);
            if (userId != null) {
                return userId;
            }
        }

        throw new IllegalStateException("Could not extract user ID from authentication");
    }

    private String getStringValue(Object value) {
        return value instanceof String str ? str.trim() : null;
    }

    @SuppressWarnings("unchecked")
    private List<String> getStringList(Object payloadValue) {
        if (!(payloadValue instanceof List<?> rawList)) {
            return null;
        }
        return rawList.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .collect(Collectors.toList());
    }

    @MessageMapping("/heartbeat")
    public void handleHeartbeat(Principal principal,
                               @Header(value = "Authorization", required = false) String authHeader,
                               @Header(value = "simpSessionId", required = false) String sessionId,
                               @Payload(required = false) Map<String, Object> heartbeatData) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            
            if (sessionId != null) {
                presenceService.handleHeartbeat(userId, sessionId);
                webSocketConnectionService.refreshSession(userId, sessionId);
                
                String deviceInfo = null;
                if (heartbeatData != null && heartbeatData.containsKey("deviceInfo")) {
                    deviceInfo = heartbeatData.get("deviceInfo").toString();
                    webSocketConnectionService.updateDeviceInfo(userId, sessionId, deviceInfo);
                }
                
                log.debug("Heartbeat for user {} session {}", userId, sessionId);
                presenceFlowMetrics.recordHeartbeat("success");
            } else {
                log.warn("Heartbeat received without session ID for user {}", userId);
                presenceFlowMetrics.recordHeartbeat("missing_session");
            }
        } catch (Exception e) {
            presenceFlowMetrics.recordHeartbeat("error");
            log.error("Error handling heartbeat: {}", e.getMessage(), e);
        }
    }

    /**
     * Handle explicit logout from a single device/tab.
     * This provides an INSTANT "Offline" status for watchers
     * instead of waiting for heartbeat TTL or Socket timeout.
     */
    @MessageMapping("/presence/logout")
    public void handleManualLogout(Principal principal,
                                  @Header(value = "Authorization", required = false) String authHeader,
                                  @Header(value = "simpSessionId") String sessionId) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            log.info("Manual logout signal received for user {} (session: {})", userId, sessionId);
            
            presenceService.handleDisconnect(userId, sessionId);
            webSocketConnectionService.unregisterConnection(userId, sessionId);
            
        } catch (Exception e) {
            log.error("Error handling manual logout: {}", e.getMessage());
        }
    }

    /**
     * Handle custom status changes (ONLINE, DND, INVISIBLE).
     * Frontend sends: { "status": "DND" } or { "status": "ONLINE" } or { "status": "INVISIBLE" }
     */
    @MessageMapping("/online-status")
    public void handleOnlineStatus(@Payload Map<String, Object> payload,
                                   Principal principal,
                                   @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            if (payload == null) {
                presenceFlowMetrics.recordStatusChange("invalid_payload");
                presenceFlowMetrics.recordStatusSyncEvent("error");
                throw new IllegalArgumentException("Missing presence payload");
            }

            String status = getStringValue(payload.get("status"));
            String traceId = getStringValue(payload.get("traceId"));
            String requestId = getStringValue(payload.get("requestId"));
            if (status == null || status.isBlank()) {
                status = "ONLINE";
            }
            
            log.info("User {} setting status to {} traceId={} requestId={}", userId, status, traceId, requestId);
            presenceFlowMetrics.recordStatusChange("request");
            presenceService.setCustomStatus(userId, status, traceId, requestId);
            presenceFlowMetrics.recordStatusChange("processed");
        } catch (Exception e) {
            presenceFlowMetrics.recordStatusChange("error");
            log.error("Error handling online-status: {}", e.getMessage(), e);
            handlePresenceSyncError(
                    principal,
                    authHeader,
                    "online-status-failed",
                    e.getMessage(),
                    null,
                    null
            );
        }
    }

    /**
     * Handle presence subscription: client sends list of userIds to watch.
     * Incremental — only adds, does not remove existing subscriptions.
     */
    @SuppressWarnings("unchecked")
    @MessageMapping("/presence.subscribe")
    public void handlePresenceSubscribe(@Payload Map<String, Object> payload,
                                        Principal principal,
                                        @Header(value = "Authorization", required = false) String authHeader,
                                        @Header(value = "simpSessionId", required = false) String sessionId) {
        try {
            if (payload == null) {
                presenceFlowMetrics.recordPresenceSubscription("subscribe", 0, "invalid_payload");
                throw new IllegalArgumentException("Missing presence.subscribe payload");
            }

            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            String traceId = getStringValue(payload.get("traceId"));
            String requestId = getStringValue(payload.get("requestId"));
            String watcherSessionId = sessionId != null ? sessionId : ("legacy-" + userId);
            Object rawUserIds = payload.get("userIds");

            List<String> userIdStrings = getStringList(rawUserIds);
            if (userIdStrings != null && !userIdStrings.isEmpty()) {
                presenceFlowMetrics.recordPresenceSubscription("subscribe", userIdStrings.size(), "start");
                List<UUID> targetIds = userIdStrings.stream()
                        .filter(Objects::nonNull)
                        .map(UUID::fromString)
                        .collect(Collectors.toList());
                presenceService.addSubscriptions(userId, watcherSessionId, targetIds);
                log.info(
                        "User {} subscribed to {} users presence traceId={} requestId={}",
                        userId,
                        targetIds.size(),
                        traceId,
                        requestId
                );
                presenceFlowMetrics.recordPresenceSubscription("subscribe", targetIds.size(), "success");

                Map<UUID, UserPresenceResponse> batch = presenceService.getBatchPresence(targetIds);
                if (batch != null && !batch.isEmpty()) {
                    for (UserPresenceResponse resp : batch.values()) {
                        OnlineStatusEvent event = OnlineStatusEvent.builder()
                                .userId(resp.getUserId())
                                .online(resp.isOnline())
                                .status(resp.getStatus())
                                .device(resp.getDevice())
                                .lastSeen(resp.getLastSeen())
                                .timestamp(resp.getLastSeen() != null ? resp.getLastSeen() : Instant.now())
                                .build();
                        messagingTemplate.convertAndSendToUser(
                                userId.toString(),
                                "/queue/presence",
                                event
                        );
                    }
                }
            } else {
                presenceFlowMetrics.recordPresenceSubscription("subscribe", 0, "empty");
            }
        } catch (Exception e) {
            presenceFlowMetrics.recordPresenceSubscription("subscribe", 0, "error");
            log.error("Error handling presence.subscribe: {}", e.getMessage(), e);
            handlePresenceSyncError(
                    principal,
                    authHeader,
                    "presence-subscribe-failed",
                    e.getMessage(),
                    null,
                    null
            );
        }
    }

    /**
     * Handle presence unsubscribe: client sends list of userIds to stop watching.
     * Removes specific users from the watcher graph.
     */
    @SuppressWarnings("unchecked")
    @MessageMapping("/presence.unsubscribe")
    public void handlePresenceUnsubscribe(@Payload Map<String, Object> payload,
                                          Principal principal,
                                          @Header(value = "Authorization", required = false) String authHeader,
                                          @Header(value = "simpSessionId", required = false) String sessionId) {
        try {
            if (payload == null) {
                presenceFlowMetrics.recordPresenceSubscription("unsubscribe", 0, "invalid_payload");
                throw new IllegalArgumentException("Missing presence.unsubscribe payload");
            }

            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            String traceId = getStringValue(payload.get("traceId"));
            String requestId = getStringValue(payload.get("requestId"));
            List<String> userIdStrings = getStringList(payload.get("userIds"));

            if (userIdStrings != null && !userIdStrings.isEmpty()) {
                presenceFlowMetrics.recordPresenceSubscription("unsubscribe", userIdStrings.size(), "start");
                String watcherSessionId = sessionId != null ? sessionId : ("legacy-" + userId);
                List<UUID> targetIds = userIdStrings.stream()
                        .filter(Objects::nonNull)
                        .map(UUID::fromString)
                        .collect(Collectors.toList());
                presenceService.removeSubscriptions(userId, watcherSessionId, targetIds);
                log.info(
                        "User {} unsubscribed from {} users presence traceId={} requestId={}",
                        userId,
                        userIdStrings.size(),
                        traceId,
                        requestId
                );
                presenceFlowMetrics.recordPresenceSubscription("unsubscribe", userIdStrings.size(), "success");
            } else {
                presenceFlowMetrics.recordPresenceSubscription("unsubscribe", 0, "empty");
            }
        } catch (Exception e) {
            presenceFlowMetrics.recordPresenceSubscription("unsubscribe", 0, "error");
            log.error("Error handling presence.unsubscribe: {}", e.getMessage(), e);
            handlePresenceSyncError(
                    principal,
                    authHeader,
                    "presence-unsubscribe-failed",
                    e.getMessage(),
                    null,
                    null
            );
        }
    }

    /**
     * Handle pull-on-reconnect: client requests batch presence for their contacts.
     * Returns full presence data (status, lastSeen, DND) on /queue/presence-batch.
     */
    @MessageMapping("/presence.batch")
    public void handlePresenceBatch(@Payload OnlineStatusRequest request,
                                    Principal principal,
                                    @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            int requestSize = request == null || request.getUserIds() == null ? 0 : request.getUserIds().size();
            String traceId = request == null ? "n/a" : request.getTraceId();
            String requestId = request == null ? "n/a" : request.getRequestId();
            log.debug(
                    "Batch presence request from user {} for {} users traceId={} requestId={}",
                    userId,
                    requestSize,
                    traceId,
                    requestId
            );
            presenceFlowMetrics.recordPresenceSubscription("batch", requestSize, "start");

            List<UUID> targetIds = request == null || request.getUserIds() == null
                    ? Collections.emptyList()
                    : request.getUserIds().stream()
                    .map(id -> (UUID) id)
                    .collect(Collectors.toList());

            Map<UUID, UserPresenceResponse> presenceMap = presenceService.getBatchPresence(targetIds);

            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/presence-batch",
                    presenceMap
            );
            presenceFlowMetrics.recordPresenceSubscription("batch", requestSize, "success");
        } catch (Exception e) {
            presenceFlowMetrics.recordPresenceSubscription("batch", 0, "error");
            log.error("Error handling presence.batch: {}", e.getMessage(), e);
            handlePresenceSyncError(
                    principal,
                    authHeader,
                    "presence-batch-failed",
                    e.getMessage(),
                    request == null ? null : request.getTraceId(),
                    request == null ? null : request.getRequestId()
            );
        }
    }
    private void sendErrorToUser(Principal principal, String authHeader, String errorMessage) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            Map<String, Object> errorResponse = Map.of(
                "type", "ERROR",
                "message", errorMessage,
                "timestamp", Instant.now()
            );
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/errors",
                    errorResponse
            );
            log.debug("Error message sent to user: {}", userId);
        } catch (Exception ex) {
            log.error("Failed to send error response: {}", ex.getMessage());
        }
    }

    private void handlePresenceSyncError(
            Principal principal,
            String authHeader,
            String errorType,
            String message,
            String traceId,
            String requestId
    ) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            presenceFlowMetrics.recordStatusSyncEvent("error");
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/presence-sync",
                    Map.of(
                            "type", "STATUS_SYNC_ERROR",
                            "errorType", errorType,
                            "message", message == null ? "Unknown presence sync error" : message,
                            "traceId", traceId == null ? "n/a" : traceId,
                            "requestId", requestId == null ? "n/a" : requestId,
                            "timestamp", Instant.now().toString()
                    )
            );
        } catch (Exception ex) {
            log.warn("Failed to send presence sync error event: {}", ex.getMessage());
        }
    }

    /**
     * Handle conversation list update events from Kafka
     * This is called when a conversation's lastActivityAt is updated (e.g., new message)
     */
    @MessageMapping("/conversation.refresh")
    public void handleConversationRefresh(@Payload Map<String, Object> payload,
                                         Principal principal,
                                         @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            UUID conversationId = UUID.fromString((String) payload.get("conversationId"));

            log.debug("Conversation refresh request from user {} for conversation {}", userId, conversationId);

            // Send updated conversation data to the user
            // The frontend will use this to update the conversation list in real-time
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/conversation-updated",
                    payload
            );

        } catch (Exception e) {
            log.error("Error handling conversation refresh: {}", e.getMessage(), e);
        }
    }

    /**
     * Handle conversation pin/unpin events
     */
    @MessageMapping("/conversation.pin")
    public void handleConversationPin(@Payload Map<String, Object> payload,
                                      Principal principal,
                                      @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            UUID conversationId = UUID.fromString((String) payload.get("conversationId"));
            boolean pin = (Boolean) payload.get("pin");

            log.info("User {} {} conversation {}", userId, pin ? "pinning" : "unpinning", conversationId);

            // Broadcast to all members of the conversation
            List<UUID> memberIds = conversationMemberService.getConversationMemberIds(conversationId);
            for (UUID memberId : memberIds) {
                messagingTemplate.convertAndSendToUser(
                        memberId.toString(),
                        "/queue/conversation-pin-changed",
                        Map.of(
                                "conversationId", conversationId,
                                "pinned", pin,
                                "userId", userId,
                                "timestamp", Instant.now()
                        )
                );
            }

        } catch (Exception e) {
            log.error("Error handling conversation pin: {}", e.getMessage(), e);
        }
    }

}
