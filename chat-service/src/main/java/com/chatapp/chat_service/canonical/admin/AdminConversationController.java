package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/conversations")
public class AdminConversationController {
    private final AdminConversationService conversations;
    private final SecurityContextHelper securityContext;

    public AdminConversationController(AdminConversationService conversations, SecurityContextHelper securityContext) {
        this.conversations = conversations;
        this.securityContext = securityContext;
    }

    @GetMapping
    public List<AdminConversationDirectoryRepository.AdminConversationSummary> list(
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "50") int limit) {
        return conversations.list(actorId(), month, limit);
    }

    @GetMapping("/{conversationId}")
    public AdminConversationDirectoryRepository.AdminConversationSummary detail(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "200") int limit) {
        return conversations.detail(actorId(), conversationId, limit);
    }

    @PutMapping("/{conversationId}/chat-policy")
    public AdminConversationDirectoryRepository.AdminConversationSummary updatePolicy(
            @PathVariable UUID conversationId,
            @RequestBody AdminConversationService.PolicyMutation request) {
        return conversations.updatePolicy(actorId(), conversationId, request);
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<AdminConversationDirectoryRepository.AdminConversationSummary> archive(
            @PathVariable UUID conversationId,
            @RequestParam String reason) {
        return ResponseEntity.ok(conversations.archive(actorId(), conversationId, reason, true));
    }

    @PostMapping("/{conversationId}/restore")
    public AdminConversationDirectoryRepository.AdminConversationSummary restore(
            @PathVariable UUID conversationId,
            @RequestParam String reason) {
        return conversations.archive(actorId(), conversationId, reason, false);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
