package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Capability-owned HTTP reads; call control stays on the authenticated STOMP contract. */
@RestController
@RequestMapping("/api/conversations/{conversationId}/calls")
public class CallQueryController {
    private final CallLifecycleService calls;
    private final SecurityContextHelper security;
    public CallQueryController(CallLifecycleService calls, SecurityContextHelper security) {
        this.calls = calls; this.security = security;
    }
    @GetMapping("/active")
    public ResponseEntity<CallSignalingService.View> active(@PathVariable UUID conversationId) {
        var state = calls.active(security.getCurrentUserId(), conversationId);
        if (state == null) return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(CallSignalingService.View.of(state));
    }
}
