package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * WebRTC signalling transport. Media is peer-to-peer; this controller only
 * authorizes participants and fans signalling messages out to the conversation.
 */
@Controller
public class CallController {
    private final ConversationAuthorizationService authorization;
    private final SecurityContextHelper securityContext;
    private final SimpMessagingTemplate messaging;

    public CallController(ConversationAuthorizationService authorization,
                          SecurityContextHelper securityContext,
                          SimpMessagingTemplate messaging) {
        this.authorization = authorization;
        this.securityContext = securityContext;
        this.messaging = messaging;
    }

    @MessageMapping("/call.start")
    public void start(CallCommand command, Principal principal) {
        publish(command, principal, "START");
    }

    @MessageMapping("/call.join")
    public void join(CallCommand command, Principal principal) {
        publish(command, principal, "JOIN");
    }

    @MessageMapping("/call.leave")
    public void leave(CallCommand command, Principal principal) {
        publish(command, principal, "LEAVE");
    }

    @MessageMapping("/call.signal")
    public void signal(CallCommand command, Principal principal) {
        publish(command, principal, "SIGNAL");
    }

    @MessageMapping("/call.end")
    public void end(CallCommand command, Principal principal) {
        publish(command, principal, "END");
    }

    private void publish(CallCommand command, Principal principal, String action) {
        if (!(principal instanceof Authentication authentication)) {
            throw new IllegalArgumentException("Authenticated STOMP principal is required");
        }
        if (command == null || command.conversationId() == null || command.callId() == null) {
            throw new IllegalArgumentException("conversationId and callId are required");
        }
        if (command.targetUserId() == null) {
            throw new IllegalArgumentException("targetUserId is required for direct calls");
        }
        if ("START".equals(action)
                && (command.callType() == null || (!"VOICE".equals(command.callType()) && !"VIDEO".equals(command.callType())))) {
            throw new IllegalArgumentException("callType must be VOICE or VIDEO for call.start");
        }
        if ("SIGNAL".equals(action) && command.signal() == null) {
            throw new IllegalArgumentException("signal is required for call.signal");
        }
        if (command.maxParticipants() != null && command.maxParticipants() != 2) {
            throw new IllegalArgumentException("direct calls support exactly 2 participants");
        }
        UUID actorId = securityContext.getCurrentUserId(authentication);
        UUID conversationId = command.conversationId();
        authorization.requireDirectPeer(conversationId, actorId, command.targetUserId());
        if ("START".equals(action)) {
            authorization.requirePermission(conversationId, actorId, ConversationPermission.CALL_START);
        }

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("conversationId", conversationId.toString());
        event.put("callId", command.callId().toString());
        if (command.callType() != null) event.put("callType", command.callType());
        if (command.mediaRegion() != null) event.put("mediaRegion", command.mediaRegion());
        if (command.maxParticipants() != null) event.put("maxParticipants", command.maxParticipants());
        if (command.targetUserId() != null) event.put("targetUserId", command.targetUserId().toString());
        if (command.signal() != null) event.put("signal", command.signal());
        event.put("actorId", actorId.toString());
        event.put("action", action);
        event.put("occurredAt", Instant.now().toString());
        messaging.convertAndSend("/topic/conversation/" + conversationId + "/calls", event);
    }

    public record CallCommand(
            UUID conversationId,
            UUID callId,
            String callType,
            String mediaRegion,
            Integer maxParticipants,
            UUID targetUserId,
            Map<String, Object> signal) {
    }
}
