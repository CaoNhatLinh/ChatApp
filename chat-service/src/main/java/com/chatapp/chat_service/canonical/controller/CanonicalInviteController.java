package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.invite.InviteService;
import com.chatapp.chat_service.canonical.invite.JoinRequestService;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
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

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/invites")
public class CanonicalInviteController {
    private final InviteService invites;
    private final JoinRequestService joinRequests;
    private final SecurityContextHelper securityContext;

    public CanonicalInviteController(
            InviteService invites,
            JoinRequestService joinRequests,
            SecurityContextHelper securityContext) {
        this.invites = invites;
        this.joinRequests = joinRequests;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalApiContracts.InviteLinkView> create(
            @Valid @RequestBody CanonicalApiContracts.InviteLinkCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(invites.create(actorId(), request));
    }

    @GetMapping("/conversation/{conversationId}")
    public com.chatapp.chat_service.canonical.invite.InviteRepository.InvitePage list(
            @PathVariable UUID conversationId,
            @RequestParam(required = false) UUID cursor,
            @RequestParam(defaultValue = "50") @Min(1) @Max(50) int limit) {
        return invites.list(actorId(), conversationId, cursor, limit);
    }

    @PostMapping("/consume")
    public CanonicalApiContracts.InviteConsumeResponse consume(
            @Valid @RequestBody CanonicalApiContracts.InviteConsumeRequest request) {
        return invites.consume(actorId(), request);
    }

    @GetMapping("/{token}/status")
    public CanonicalApiContracts.InviteViewerState viewerState(@PathVariable String token) {
        return invites.viewerState(actorId(), token);
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> revoke(@PathVariable String token) {
        invites.revoke(actorId(), token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{token}/decline")
    public CanonicalApiContracts.InviteConsumeResponse decline(@PathVariable String token) {
        return invites.decline(actorId(), token);
    }

    @GetMapping("/conversation/{conversationId}/requests")
    public JoinRequestService.JoinRequestPage listRequests(
            @PathVariable UUID conversationId,
            @RequestParam(required = false) UUID cursor,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) {
        return joinRequests.list(actorId(), conversationId, cursor, limit);
    }

    @PostMapping("/conversation/{conversationId}/requests/{requestId}/resolve")
    public CanonicalApiContracts.JoinRequestView resolveRequest(
            @PathVariable UUID conversationId,
            @PathVariable UUID requestId,
            @Valid @RequestBody CanonicalApiContracts.JoinRequestDecisionRequest request) {
        return joinRequests.resolve(actorId(), conversationId, requestId, request);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
