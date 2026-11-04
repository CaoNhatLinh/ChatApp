package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.message.SharedContentService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations/{conversationId}/shared-content")
public class SharedContentController {
    private final SharedContentService content;
    private final SecurityContextHelper security;
    public SharedContentController(SharedContentService content, SecurityContextHelper security) {
        this.content = content;
        this.security = security;
    }
    @GetMapping
    public SharedContentService.Page list(@PathVariable UUID conversationId,
            @RequestParam(defaultValue = "IMAGES") String kind, @RequestParam(required = false) String cursor) {
        return content.list(security.getCurrentUserId(), conversationId, kind, cursor);
    }

    @GetMapping("/{messageId}")
    public com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage source(
            @PathVariable UUID conversationId, @PathVariable UUID messageId, @RequestParam String bucket) {
        if (messageId.version() != 1 || !bucket.matches("\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}"))
            throw new com.chatapp.chat_service.common.exception.BadRequestException("invalid message bucket");
        return content.source(security.getCurrentUserId(), conversationId, bucket, messageId);
    }
}
