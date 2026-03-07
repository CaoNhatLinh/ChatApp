package com.chatapp.chat_service.websocket.controller;


import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.conversation.service.ConversationMemberService;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.event.MessageEvent;
import com.chatapp.chat_service.notification.service.NotificationService;
import com.chatapp.chat_service.presence.dto.OnlineStatusRequest;
import com.chatapp.chat_service.presence.dto.OnlineStatusResponse;
import com.chatapp.chat_service.presence.dto.UserPresenceResponse;
import com.chatapp.chat_service.presence.event.OnlineStatusEvent;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

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

@MessageMapping("/message.send")
    public void handleNewMessage(@Payload MessageEvent event, 
                                Principal principal,
                                @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID senderId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            UUID conversationId = event.getPayload().getConversationId();
            
            if (!conversationMemberService.isMemberOfConversation(conversationId, senderId)) {
                log.warn("User {} attempted to send message to conversation {} without membership", senderId, conversationId);
                sendErrorToUser(principal, authHeader, "You are not a member of this conversation");
                return;
            }
            
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
            
            if (!conversationMemberService.isMemberOfConversation(conversationId, senderId)) {
                log.warn("User {} attempted to send file to conversation {} without membership", senderId, conversationId);
                sendErrorToUser(principal, authHeader, "You are not a member of this conversation");
                return;
            }
            
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



    @MessageMapping("/request-online-status")
    public void handleRequestOnlineStatus(@Payload OnlineStatusRequest request, 
                                         Principal principal,
                                         @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            log.debug("request-online-status for user: {}", userId);
            Map<UUID, Boolean> statusMap = request.getUserIds().stream()
                    .collect(Collectors.toMap(
                            Function.identity(),
                            presenceService::isUserOnline
                    ));

            OnlineStatusResponse response = OnlineStatusResponse.builder()
                    .statusMap(statusMap)
                    .timestamp(Instant.now())
                    .build();
            log.debug("OnlineStatusResponse: {}", response);
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/online-status",
                    response
            );
        } catch (Exception e) {
            log.error("Error handling request online status: {}", e.getMessage(), e);
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
            } else {
                log.warn("Heartbeat received without session ID for user {}", userId);
            }
        } catch (Exception e) {
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
            String status = payload.containsKey("status")
                    ? payload.get("status").toString()
                    : "ONLINE";
            
            log.info("User {} setting status to {}", userId, status);
            presenceService.setCustomStatus(userId, status);
        } catch (Exception e) {
            log.error("Error handling online-status: {}", e.getMessage(), e);
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
                                        @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            List<String> userIdStrings = (List<String>) payload.get("userIds");
            
            if (userIdStrings != null && !userIdStrings.isEmpty()) {
                List<UUID> targetIds = userIdStrings.stream()
                        .map(UUID::fromString)
                        .collect(Collectors.toList());
                presenceService.addSubscriptions(userId, targetIds);
                log.info("User {} subscribed to {} users presence", userId, targetIds.size());

                Map<UUID, UserPresenceResponse> batch = presenceService.getBatchPresence(targetIds);
                if (batch != null && !batch.isEmpty()) {
                    for (UserPresenceResponse resp : batch.values()) {
                        OnlineStatusEvent event = OnlineStatusEvent.builder()
                                .userId(resp.getUserId())
                                .online(resp.isOnline())
                                .status(resp.getStatus())
                                .timestamp(Instant.now())
                                .build();
                        messagingTemplate.convertAndSendToUser(
                                userId.toString(),
                                "/queue/presence",
                                event
                        );
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error handling presence.subscribe: {}", e.getMessage(), e);
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
                                          @Header(value = "Authorization", required = false) String authHeader) {
        try {
            UUID userId = extractUserIdFromPrincipalOrToken(principal, authHeader);
            List<String> userIdStrings = (List<String>) payload.get("userIds");
            
            if (userIdStrings != null && !userIdStrings.isEmpty()) {
                List<UUID> targetIds = userIdStrings.stream()
                        .map(UUID::fromString)
                        .collect(Collectors.toList());
                presenceService.removeSubscriptions(userId, targetIds);
                log.info("User {} unsubscribed from {} users presence", userId, userIdStrings.size());
            }
        } catch (Exception e) {
            log.error("Error handling presence.unsubscribe: {}", e.getMessage(), e);
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
            log.debug("Batch presence request from user {} for {} users", userId, request.getUserIds().size());

            List<UUID> targetIds = request.getUserIds().stream()
                    .map(id -> (UUID) id)
                    .collect(Collectors.toList());

            Map<UUID, UserPresenceResponse> presenceMap = presenceService.getBatchPresence(targetIds);

            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/presence-batch",
                    presenceMap
            );
        } catch (Exception e) {
            log.error("Error handling presence.batch: {}", e.getMessage(), e);
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
    
}