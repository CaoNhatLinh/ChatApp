package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/invites")
public class CanonicalInviteController {
    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalInviteController(CanonicalBackendService backend, SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalApiContracts.InviteLinkView> create(
            @RequestBody CanonicalApiContracts.InviteLinkCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(backend.createInvite(actorId(), request));
    }

    @GetMapping("/conversation/{conversationId}")
    public List<CanonicalInviteLink> list(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "50") @Min(1) @Max(50) int limit) {
        return backend.listInvite(actorId(), conversationId, limit);
    }

    @PostMapping("/consume")
    public CanonicalApiContracts.InviteConsumeResponse consume(
            @RequestBody CanonicalApiContracts.InviteConsumeRequest request) {
        return backend.consumeInvite(actorId(), request);
    }

    @GetMapping("/{token}/status")
    public CanonicalApiContracts.InviteViewerState viewerState(@PathVariable String token) {
        return backend.getInviteViewerState(actorId(), token);
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> revoke(@PathVariable String token) {
        backend.revokeInvite(actorId(), token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{token}/decline")
    public CanonicalApiContracts.InviteConsumeResponse decline(@PathVariable String token) {
        return backend.declineInvite(actorId(), token);
    }

    @GetMapping("/conversation/{conversationId}/requests")
    public List<CanonicalApiContracts.JoinRequestView> listRequests(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) {
        return backend.listJoinRequests(actorId(), conversationId, limit);
    }

    @PostMapping("/conversation/{conversationId}/requests/{requestId}/resolve")
    public CanonicalApiContracts.JoinRequestView resolveRequest(
            @PathVariable UUID conversationId,
            @PathVariable UUID requestId,
            @RequestBody CanonicalApiContracts.JoinRequestDecisionRequest request) {
        return backend.resolveJoinRequest(actorId(), conversationId, requestId, request);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
