package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.service.ConversationRoleService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
public class CanonicalConversationController {

    private final CanonicalBackendService backend;
    private final ConversationRoleService roles;
    private final ConversationAuthorizationService authorization;
    private final SecurityContextHelper securityContext;

    public CanonicalConversationController(
            CanonicalBackendService backend,
            ConversationRoleService roles,
            ConversationAuthorizationService authorization,
            SecurityContextHelper securityContext) {
        this.backend = backend;
        this.roles = roles;
        this.authorization = authorization;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalConversation> create(
            @RequestBody CanonicalApiContracts.ConversationCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(backend.createConversation(actorId(), request));
    }

    @GetMapping
    public List<CanonicalApiContracts.ConversationListItem> list(@RequestParam(defaultValue = "50") int limit) {
        return backend.listMyConversations(actorId(), limit);
    }

    @GetMapping("/{conversationId}")
    public CanonicalConversation get(@PathVariable UUID conversationId) {
        authorization.requireMember(conversationId, actorId());
        return backend.getConversation(conversationId);
    }

    @GetMapping("/{conversationId}/notification-policy")
    public CanonicalApiContracts.ConversationNotificationPolicyView getNotificationPolicy(
            @PathVariable UUID conversationId) {
        return backend.getConversationNotificationPolicy(actorId(), conversationId);
    }

    @GetMapping("/dm/{otherUserId}")
    public CanonicalConversation findDm(@PathVariable UUID otherUserId) {
        return backend.findMyDm(actorId(), otherUserId);
    }

    @GetMapping("/{conversationId}/members")
    public List<CanonicalApiContracts.ConversationMemberView> listMembers(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "200") int limit) {
        return backend.listConversationMembers(actorId(), conversationId, limit);
    }

    @PostMapping("/{conversationId}/members")
    public ResponseEntity<Void> addMember(
            @PathVariable UUID conversationId,
            @RequestBody CanonicalApiContracts.ConversationMemberRequest request) {
        backend.addMember(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{conversationId}/members/{userId}")
    public ResponseEntity<Void> kickMember(@PathVariable UUID conversationId, @PathVariable UUID userId) {
        backend.removeMember(actorId(), conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/leave")
    public ResponseEntity<Void> leave(@PathVariable UUID conversationId) {
        backend.leaveConversation(actorId(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/pin")
    public ResponseEntity<Void> pin(@PathVariable UUID conversationId) {
        backend.pinConversation(actorId(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{conversationId}/pin")
    public ResponseEntity<Void> unpin(@PathVariable UUID conversationId) {
        backend.unpinConversation(actorId(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{conversationId}/roles")
    public List<ConversationRole> listRoles(@PathVariable UUID conversationId) {
        return roles.list(actorId(), conversationId);
    }

    @GetMapping("/{conversationId}/permissions")
    public CanonicalApiContracts.ConversationPermissionsView permissions(
            @PathVariable UUID conversationId) {
        return roles.permissions(actorId(), conversationId);
    }

    @PostMapping("/{conversationId}/roles")
    public ResponseEntity<ConversationRole> createRole(
            @PathVariable UUID conversationId,
            @RequestBody CanonicalApiContracts.ConversationRoleCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roles.create(actorId(), conversationId, request));
    }

    @DeleteMapping("/{conversationId}/roles/{roleId}")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID conversationId, @PathVariable UUID roleId) {
        roles.delete(actorId(), conversationId, roleId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/roles/{roleId}")
    public ConversationRole updateRole(
            @PathVariable UUID conversationId,
            @PathVariable UUID roleId,
            @Valid @RequestBody CanonicalApiContracts.ConversationRoleUpdateRequest request) {
        return roles.update(actorId(), conversationId, roleId, request);
    }

    @PostMapping("/{conversationId}/members/{userId}/roles")
    public ResponseEntity<Void> assignRoles(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId,
            @Valid @RequestBody CanonicalApiContracts.ConversationRoleAssignmentRequest request) {
        roles.assign(actorId(), conversationId, userId, request.roleIds());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/ownership/{userId}")
    public ResponseEntity<Void> transferOwnership(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId) {
        roles.transferOwnership(actorId(), conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/chat-policy")
    public ResponseEntity<Void> updateChatPolicy(
            @PathVariable UUID conversationId,
            @RequestBody CanonicalApiContracts.ConversationChatPolicyRequest request) {
        backend.updateConversationChatPolicy(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/notification-policy")
    public ResponseEntity<Void> updateNotificationPolicy(
            @PathVariable UUID conversationId,
            @Valid @RequestBody CanonicalApiContracts.ConversationNotificationPolicyRequest request) {
        backend.updateConversationNotificationPolicy(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/members/{userId}/notification-policy")
    public ResponseEntity<Void> updateMemberNotificationPolicy(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId,
            @Valid @RequestBody CanonicalApiContracts.MemberNotificationPolicyRequest request) {
        backend.updateMemberNotificationPolicy(actorId(), conversationId, userId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/members/{userId}/chat-policy")
    public ResponseEntity<Void> updateMemberChatPolicy(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId,
            @Valid @RequestBody CanonicalApiContracts.MemberChatPolicyRequest request) {
        backend.updateMemberChatPolicy(actorId(), conversationId, userId, request);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
