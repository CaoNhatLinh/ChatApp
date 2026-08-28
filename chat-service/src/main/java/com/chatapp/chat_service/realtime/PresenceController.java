package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.messaging.handler.annotation.MessageMapping;
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
    public void subscribe(PresenceService.PresenceSubscription command, Principal principal) {
        presence.subscribe(actorId(principal), command);
    }

    @MessageMapping("/presence.unsubscribe")
    public void unsubscribe(PresenceService.PresenceSubscription command, Principal principal) {
        presence.unsubscribe(actorId(principal), command);
    }

    @MessageMapping("/presence.batch")
    public void batch(PresenceService.PresenceSubscription command, Principal principal) {
        presence.sendBatch(actorId(principal), command);
    }

    @MessageMapping("/heartbeat")
    public void heartbeat(PresenceService.HeartbeatCommand command, Principal principal) {
        presence.heartbeat(actorId(principal), command);
    }

    @MessageMapping("/online-status")
    public void status(PresenceService.PresenceStatusCommand command, Principal principal) {
        presence.setStatus(actorId(principal), command);
    }

    @MessageMapping("/presence.logout")
    public void logout(Principal principal) {
        presence.logout(actorId(principal));
    }

    private UUID actorId(Principal principal) {
        if (principal instanceof Authentication authentication) {
            return securityContext.getCurrentUserId(authentication);
        }
        throw new IllegalArgumentException("Authenticated STOMP principal is required");
    }
}
