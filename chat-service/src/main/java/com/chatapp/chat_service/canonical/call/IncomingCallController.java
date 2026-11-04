package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Authenticated global discovery; call control remains on the STOMP contract. */
@RestController
@RequestMapping("/api/calls")
public class IncomingCallController {
    private final IncomingCallService calls;
    private final SecurityContextHelper security;

    public IncomingCallController(IncomingCallService calls, SecurityContextHelper security) {
        this.calls = calls;
        this.security = security;
    }

    @GetMapping(value = "/incoming", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<IncomingCallService.Page> incoming(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(calls.list(security.getCurrentUserId(), cursor, limit));
    }
}
