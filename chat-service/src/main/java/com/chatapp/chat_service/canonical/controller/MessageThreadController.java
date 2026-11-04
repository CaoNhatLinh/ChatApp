package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.message.MessageThreadService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations/{conversationId}/messages/{messageId}/replies")
public class MessageThreadController {
    private final MessageThreadService threads;
    private final SecurityContextHelper security;

    public MessageThreadController(MessageThreadService threads, SecurityContextHelper security) {
        this.threads = threads;
        this.security = security;
    }

    @GetMapping
    public MessageThreadService.Page list(@PathVariable UUID conversationId, @PathVariable UUID messageId,
            @RequestParam String bucket, @RequestParam(defaultValue = "25") int limit,
            @RequestParam(required = false) String cursor) {
        return threads.list(security.getCurrentUserId(), conversationId, bucket, messageId, limit, cursor);
    }
}
