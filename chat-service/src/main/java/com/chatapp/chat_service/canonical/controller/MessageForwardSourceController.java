package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.message.MessageForwardSourceService;
import com.chatapp.chat_service.canonical.message.MessageForwardPolicy;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations/{conversationId}/messages/{messageId}")
public class MessageForwardSourceController {
    private final MessageForwardSourceService sources;
    private final SecurityContextHelper security;
    private final MessageForwardPolicy forwards;

    public MessageForwardSourceController(MessageForwardSourceService sources, SecurityContextHelper security, MessageForwardPolicy forwards) {
        this.sources = sources; this.security = security;
        this.forwards = forwards;
    }

    @GetMapping("/forward-source")
    public MessageForwardSourceService.Source get(@PathVariable UUID conversationId, @PathVariable UUID messageId,
                                                  @RequestParam String bucket) {
        return sources.get(security.getCurrentUserId(), conversationId, bucket, messageId);
    }

    @GetMapping("/forward-draft")
    public MessageForwardPolicy.Draft prepare(@PathVariable UUID conversationId, @PathVariable UUID messageId, @RequestParam String bucket) {
        return forwards.prepare(security.getCurrentUserId(), conversationId, bucket, messageId);
    }
}
