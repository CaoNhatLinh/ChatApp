package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmailHistoryController {
    private final EmailHistoryService history;
    private final SecurityContextHelper security;

    public EmailHistoryController(EmailHistoryService history, SecurityContextHelper security) {
        this.history = history;
        this.security = security;
    }

    @GetMapping(value = "/api/notifications/email-history", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<EmailHistoryService.Page> list(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(history.list(security.getCurrentUserId(), month, cursor, limit));
    }
}
