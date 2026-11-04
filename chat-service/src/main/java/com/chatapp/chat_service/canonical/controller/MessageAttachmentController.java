package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.message.MessageAttachmentReader;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/conversations/{conversationId}/messages/{messageId}/attachments")
public class MessageAttachmentController {
    private final MessageAttachmentReader attachments;
    private final SecurityContextHelper security;
    public MessageAttachmentController(MessageAttachmentReader attachments, SecurityContextHelper security) {
        this.attachments = attachments;
        this.security = security;
    }
    @GetMapping
    public ResponseEntity<MessageAttachmentReader.Page> list(@PathVariable UUID conversationId, @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}") String bucket,
            @RequestParam(defaultValue = "25") @Min(1) @Max(50) int limit, @RequestParam(required = false) UUID cursor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(attachments.list(security.getCurrentUserId(), conversationId, bucket, messageId, limit, cursor));
    }
}
