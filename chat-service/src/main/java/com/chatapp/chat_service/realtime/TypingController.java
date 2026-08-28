package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class TypingController {
    private final TypingService typing;
    private final SecurityContextHelper securityContext;

    public TypingController(TypingService typing, SecurityContextHelper securityContext) {
        this.typing = typing;
        this.securityContext = securityContext;
    }

    @MessageMapping("/typing")
    public void updateTyping(TypingService.TypingCommand command, Principal principal) {
        if (!(principal instanceof Authentication authentication)) {
            throw new IllegalArgumentException("Authenticated STOMP principal is required");
        }
        typing.update(securityContext.getCurrentUserId(authentication), command);
    }
}
