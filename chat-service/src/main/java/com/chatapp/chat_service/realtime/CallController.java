package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.call.CallSignalingService;
import com.chatapp.chat_service.canonical.call.CallSignalingService.Action;
import com.chatapp.chat_service.canonical.call.CallSignalingService.Command;
import com.chatapp.chat_service.canonical.call.CallSignalingService.Result;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Authenticated adapter for durable control and ephemeral media signaling.
 */
@Controller
@SendToUser(destinations = "/queue/call-results", broadcast = false)
public class CallController {
    private final CallSignalingService calls;
    private final SecurityContextHelper securityContext;

    public CallController(CallSignalingService calls, SecurityContextHelper securityContext) {
        this.calls = calls;
        this.securityContext = securityContext;
    }

    @MessageMapping("/call.start")
    public Result start(Command command, Principal principal) {
        return execute(command, principal, Action.START);
    }

    @MessageMapping("/call.join")
    public Result join(Command command, Principal principal) {
        return execute(command, principal, Action.JOIN);
    }

    @MessageMapping("/call.leave")
    public Result leave(Command command, Principal principal) {
        return execute(command, principal, Action.LEAVE);
    }

    @MessageMapping("/call.signal")
    public Result signal(Command command, Principal principal) {
        return execute(command, principal, Action.SIGNAL);
    }

    @MessageMapping("/call.end")
    public Result end(Command command, Principal principal) {
        return execute(command, principal, Action.END);
    }

    @MessageMapping("/call.fail")
    public Result fail(Command command, Principal principal) { return execute(command, principal, Action.FAIL); }

    @MessageMapping("/call.heartbeat")
    public Result heartbeat(Command command, Principal principal) { return execute(command, principal, Action.HEARTBEAT); }

    @MessageMapping("/call.sync")
    public Result sync(Command command, Principal principal) { return execute(command, principal, Action.SYNC); }

    private Result execute(Command command, Principal principal, Action action) {
        if (!(principal instanceof Authentication authentication) || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException("Authenticated STOMP principal is required");
        }
        return calls.execute(securityContext.getCurrentUserId(authentication), action, command);
    }
}
