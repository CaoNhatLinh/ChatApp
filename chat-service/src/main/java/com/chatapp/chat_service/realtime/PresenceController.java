package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class PresenceController {
    private final PresenceService presence;
    private final SecurityContextHelper securityContext;

    public PresenceController(PresenceService presence, SecurityContextHelper securityContext) {
        this.presence = presence;
        this.securityContext = securityContext;
    }

    @MessageMapping("/presence.subscribe")
    public void subscribe(
            PresenceService.PresenceSubscription command,
            Principal principal,
            @Header("simpSessionId") String sessionId) {
        presence.subscribe(actorId(principal), sessionId, command);
    }

    @MessageMapping("/presence.unsubscribe")
    public void unsubscribe(
            PresenceService.PresenceSubscription command,
            Principal principal,
            @Header("simpSessionId") String sessionId) {
        presence.unsubscribe(actorId(principal), sessionId, command);
    }

    @MessageMapping("/presence.batch")
    public void batch(PresenceService.PresenceSubscription command, Principal principal) {
        presence.sendBatch(actorId(principal), command);
    }

    @MessageMapping("/heartbeat")
    public void heartbeat(
            PresenceService.HeartbeatCommand command,
            Principal principal,
            @Header("simpSessionId") String sessionId) {
        presence.heartbeat(actorId(principal), sessionId, command);
    }

    @MessageMapping("/online-status")
    public void status(
            PresenceService.PresenceStatusCommand command,
            Principal principal,
            @Header("simpSessionId") String sessionId) {
        presence.setStatus(actorId(principal), sessionId, command);
    }

    @MessageMapping("/presence.logout")
    public void logout(
            Principal principal,
            @Header("simpSessionId") String sessionId) {
        presence.logout(actorId(principal), sessionId);
    }

    private UUID actorId(Principal principal) {
        if (principal instanceof Authentication authentication) {
            return securityContext.getCurrentUserId(authentication);
        }
        throw new IllegalArgumentException("Authenticated STOMP principal is required");
    }
}
