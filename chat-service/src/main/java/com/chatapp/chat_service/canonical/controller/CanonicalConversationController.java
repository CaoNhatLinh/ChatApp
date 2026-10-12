package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.service.ConversationService;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.service.ConversationRoleService;
import com.chatapp.chat_service.canonical.service.RoomAuditService;
import com.chatapp.chat_service.canonical.moderation.ConversationBanService;
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

    private final ConversationService conversations;
    private final ConversationRoleService roles;
    private final ConversationAuthorizationService authorization;
    private final RoomAuditService roomAudit;
    private final SecurityContextHelper securityContext;
    private final ConversationBanService bans;

    public CanonicalConversationController(
            ConversationService conversations,
            ConversationRoleService roles,
            ConversationAuthorizationService authorization,
            RoomAuditService roomAudit,
            ConversationBanService bans,
            SecurityContextHelper securityContext) {
        this.conversations = conversations;
        this.roles = roles;
        this.authorization = authorization;
        this.roomAudit = roomAudit;
        this.bans = bans;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalConversation> create(
            @RequestBody CanonicalApiContracts.ConversationCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(conversations.createConversation(actorId(), request));
    }

    @GetMapping
    public CanonicalApiContracts.ConversationPage list(
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String cursor) {
        return conversations.listMyConversations(actorId(), cursor, limit);
    }

    @GetMapping("/{conversationId}")
    public CanonicalConversation get(@PathVariable UUID conversationId) {
        authorization.requireMember(conversationId, actorId());
        return conversations.getConversation(conversationId);
    }

    @GetMapping("/{conversationId}/notification-policy")
    public CanonicalApiContracts.ConversationNotificationPolicyView getNotificationPolicy(
            @PathVariable UUID conversationId) {
        return conversations.getConversationNotificationPolicy(actorId(), conversationId);
    }

    @GetMapping("/dm/{otherUserId}")
    public CanonicalConversation findDm(@PathVariable UUID otherUserId) {
        return conversations.findMyDm(actorId(), otherUserId);
    }

    @GetMapping("/{conversationId}/members")
    public CanonicalApiContracts.ConversationMemberPage listMembers(
            @PathVariable UUID conversationId,
            @RequestParam(required = false) UUID afterUserId,
            @RequestParam(defaultValue = "100") int limit) {
        return conversations.listConversationMembers(actorId(), conversationId, afterUserId, limit);
    }

    @PostMapping("/{conversationId}/members")
    public ResponseEntity<Void> addMember(
            @PathVariable UUID conversationId,
            @RequestBody CanonicalApiContracts.ConversationMemberRequest request) {
        conversations.addMember(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{conversationId}/members/{userId}")
    public ResponseEntity<Void> kickMember(@PathVariable UUID conversationId, @PathVariable UUID userId) {
        conversations.removeMember(actorId(), conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{conversationId}/bans")
    public List<CanonicalApiContracts.ConversationBanView> listBans(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "100") int limit) {
        return bans.list(actorId(), conversationId, limit);
    }

    @PutMapping("/{conversationId}/bans/{userId}")
    public CanonicalApiContracts.ConversationBanView banMember(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId,
            @Valid @RequestBody CanonicalApiContracts.ConversationBanRequest request) {
        return bans.ban(actorId(), conversationId, userId, request);
    }

    @DeleteMapping("/{conversationId}/bans/{userId}")
    public ResponseEntity<Void> unbanMember(@PathVariable UUID conversationId, @PathVariable UUID userId) {
        bans.unban(actorId(), conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/leave")
    public ResponseEntity<Void> leave(@PathVariable UUID conversationId) {
        conversations.leaveConversation(actorId(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/pin")
    public ResponseEntity<Void> pin(@PathVariable UUID conversationId) {
        conversations.pinConversation(actorId(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{conversationId}/pin")
    public ResponseEntity<Void> unpin(@PathVariable UUID conversationId) {
        conversations.unpinConversation(actorId(), conversationId);
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

    @GetMapping("/{conversationId}/audit")
    public CanonicalApiContracts.RoomAuditPage audit(
            @PathVariable UUID conversationId,
            @RequestParam String month,
            @RequestParam(required = false) UUID beforeEventId,
            @RequestParam(defaultValue = "50") int limit) {
        return roomAudit.list(actorId(), conversationId, month, beforeEventId, limit);
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
        conversations.updateConversationChatPolicy(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/notification-policy")
    public ResponseEntity<Void> updateNotificationPolicy(
            @PathVariable UUID conversationId,
            @Valid @RequestBody CanonicalApiContracts.ConversationNotificationPolicyRequest request) {
        conversations.updateConversationNotificationPolicy(actorId(), conversationId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/members/{userId}/notification-policy")
    public ResponseEntity<Void> updateMemberNotificationPolicy(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId,
            @Valid @RequestBody CanonicalApiContracts.MemberNotificationPolicyRequest request) {
        conversations.updateMemberNotificationPolicy(actorId(), conversationId, userId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/members/{userId}/chat-policy")
    public ResponseEntity<Void> updateMemberChatPolicy(
            @PathVariable UUID conversationId,
            @PathVariable UUID userId,
            @Valid @RequestBody CanonicalApiContracts.MemberChatPolicyRequest request) {
        conversations.updateMemberChatPolicy(actorId(), conversationId, userId, request);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
