package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;

@RestController
public class AdminEmailReviewController {
    private final AdminEmailReviewService service;
    private final AdminEmailReviewDispositionService dispositions;
    private final SecurityContextHelper security;

    public AdminEmailReviewController(AdminEmailReviewService service, AdminEmailReviewDispositionService dispositions,
                                      SecurityContextHelper security) {
        this.service = service;
        this.dispositions = dispositions;
        this.security = security;
    }

    @PutMapping(value = "/api/admin/email-review/{userId}/{month}/{notificationId}/disposition",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AdminEmailReviewDispositionService.Result> close(
            @PathVariable UUID userId, @PathVariable String month, @PathVariable UUID notificationId,
            @RequestBody AdminEmailReviewDispositionService.Request request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(dispositions.close(security.getCurrentUserId(), userId, month, notificationId, request));
    }

    @GetMapping(value = "/api/admin/email-review", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AdminEmailReviewService.Page> list(
            @RequestParam(required = false) String day,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.list(security.getCurrentUserId(), day, cursor, limit));
    }
}
