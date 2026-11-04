package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Read signaling history only; control/media remain separate capabilities. */
@RestController
@RequestMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
public class CallHistoryController {
    private final CallHistoryService calls;
    private final SecurityContextHelper security;
    public CallHistoryController(CallHistoryService calls, SecurityContextHelper security) {
        this.calls = calls; this.security = security;
    }
    @GetMapping("/calls/history")
    public ResponseEntity<CallHistoryService.Page> own(@RequestParam String month,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "25") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(calls.own(security.getCurrentUserId(), month, cursor, limit));
    }
    @GetMapping("/conversations/{conversationId}/calls/history")
    public ResponseEntity<CallHistoryService.Page> conversation(@PathVariable UUID conversationId, @RequestParam String month,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "25") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(calls.conversation(security.getCurrentUserId(), conversationId, month, cursor, limit));
    }
    @GetMapping("/conversations/{conversationId}/calls/{callId}/history")
    public ResponseEntity<CallHistoryView> detail(@PathVariable UUID conversationId, @PathVariable UUID callId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(calls.detail(security.getCurrentUserId(), conversationId, callId));
    }
}
