package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
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

@Validated
@RestController
@RequestMapping("/api/conversations/{conversationId}/messages")
public class CanonicalMessageController {
    private static final String BUCKET_PATTERN = "\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}";

    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalMessageController(CanonicalBackendService backend, SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalMessage> send(
            @PathVariable UUID conversationId,
            @Valid @RequestBody CanonicalApiContracts.MessageSendRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(backend.sendMessage(actorId(), conversationId, request));
    }

    @GetMapping
    public CanonicalApiContracts.MessagePage list(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
            @RequestParam(required = false) String cursor) {
        return backend.listMessageHistory(actorId(), conversationId, limit, cursor);
    }

    @GetMapping("/{messageId}")
    public CanonicalMessage get(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket) {
        return backend.getMessage(actorId(), conversationId, bucket, messageId);
    }

    @PutMapping("/{messageId}")
    public CanonicalMessage edit(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket,
            @RequestBody CanonicalApiContracts.MessageUpdateRequest request) {
        return backend.editMessage(actorId(), conversationId, bucket, messageId, request);
    }

    @DeleteMapping("/{messageId}")
    public CanonicalMessage delete(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket) {
        return backend.deleteMessage(actorId(), conversationId, bucket, messageId);
    }

    @PostMapping("/{messageId}/reactions")
    public ResponseEntity<Void> react(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket,
            @RequestBody CanonicalApiContracts.MessageReactionRequest request) {
        backend.reaction(actorId(), conversationId, bucket, messageId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{messageId}/reactions")
    public ResponseEntity<Void> removeReaction(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket,
            @RequestParam String emoji) {
        backend.removeReaction(actorId(), conversationId, bucket, messageId, emoji);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{messageId}/read")
    public ResponseEntity<Void> markRead(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket) {
        backend.markMessageRead(actorId(), conversationId, bucket, messageId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{messageId}/read-receipts")
    public CanonicalApiContracts.MessageReadReceiptPage readReceipts(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket,
            @RequestParam(defaultValue = "25") @Min(1) @Max(50) int limit,
            @RequestParam(required = false) UUID cursor) {
        return backend.listMessageReadReceipts(actorId(), conversationId, bucket, messageId, limit, cursor);
    }

    @GetMapping("/{messageId}/revisions")
    public List<CanonicalApiContracts.MessageRevisionView> revisions(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket) {
        return backend.listMessageRevisions(actorId(), conversationId, bucket, messageId);
    }

    @PostMapping("/{messageId}/pin")
    public CanonicalMessage pin(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket) {
        return backend.pinMessage(actorId(), conversationId, bucket, messageId);
    }

    @DeleteMapping("/{messageId}/pin")
    public CanonicalMessage unpin(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestParam @Pattern(regexp = BUCKET_PATTERN) String bucket) {
        return backend.unpinMessage(actorId(), conversationId, bucket, messageId);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
