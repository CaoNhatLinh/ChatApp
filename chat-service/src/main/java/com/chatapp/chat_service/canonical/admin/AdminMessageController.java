package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/admin/messages")
public class AdminMessageController {
    private static final String BUCKET_PATTERN = "\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}";

    private final AdminMessageService messages;
    private final SecurityContextHelper securityContext;

    public AdminMessageController(AdminMessageService messages, SecurityContextHelper securityContext) {
        this.messages = messages;
        this.securityContext = securityContext;
    }

    @GetMapping("/{conversationId}/{messageId}")
    public AdminMessageService.AdminMessageInspection inspect(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket,
            @RequestParam String reason) {
        return messages.inspect(securityContext.getCurrentUserId(), conversationId, bucket, messageId, reason);
    }
}
