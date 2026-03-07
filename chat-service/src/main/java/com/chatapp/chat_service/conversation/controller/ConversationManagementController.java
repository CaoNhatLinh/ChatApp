package com.chatapp.chat_service.conversation.controller;

import com.chatapp.chat_service.common.dto.ApiResponse;
import com.chatapp.chat_service.conversation.dto.AddMemberRequest;
import com.chatapp.chat_service.conversation.dto.ConversationMemberDto;
import com.chatapp.chat_service.conversation.dto.CreateInvitationLinkRequest;
import com.chatapp.chat_service.conversation.dto.GrantAdminRequest;
import com.chatapp.chat_service.conversation.dto.InvitationLinkDto;
import com.chatapp.chat_service.conversation.dto.TransferOwnershipRequest;
import com.chatapp.chat_service.conversation.service.ConversationMemberService;
import com.chatapp.chat_service.conversation.service.InvitationLinkService;

import com.chatapp.chat_service.security.core.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Controller for conversation management (groups/channels).
 * Includes: member management, admin roles, invitation links.
 */
@RestController
@RequestMapping("/api/conversations/{conversationId}/management")
@RequiredArgsConstructor
public class ConversationManagementController {

    private final ConversationMemberService memberService;
    private final InvitationLinkService invitationLinkService;

    // ────────────────── Member Queries ──────────────────

    @GetMapping("/members")
    public ResponseEntity<org.springframework.data.domain.Slice<ConversationMemberDto>> getMembers(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);

        if (!memberService.isMemberOfConversation(conversationId, userId)) {
            return ResponseEntity.status(403).build();
        }

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        org.springframework.data.domain.Slice<ConversationMemberDto> members =
                memberService.getConversationMembers(conversationId, pageable);
        return ResponseEntity.ok(members);
    }

    // ────────────────── Member Commands ──────────────────

    @PostMapping("/members/add")
    public ResponseEntity<ApiResponse<Void>> addMembers(
            @PathVariable UUID conversationId,
            @RequestBody AddMemberRequest request,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        memberService.addMembers(conversationId, request.getMemberIds(), userId);
        return ResponseEntity.ok(ApiResponse.success("Members added successfully", null));
    }

    @DeleteMapping("/members/{memberId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID conversationId,
            @PathVariable UUID memberId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        memberService.removeMember(conversationId, memberId, userId);
        return ResponseEntity.ok(ApiResponse.success("Member removed successfully", null));
    }

    @PostMapping("/leave")
    public ResponseEntity<ApiResponse<Void>> leaveConversation(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        memberService.leaveConversation(conversationId, userId);
        return ResponseEntity.ok(ApiResponse.success("Left conversation successfully", null));
    }

    // ────────────────── Role Management ──────────────────

    @PostMapping("/transfer-ownership")
    public ResponseEntity<ApiResponse<Void>> transferOwnership(
            @PathVariable UUID conversationId,
            @RequestBody TransferOwnershipRequest request,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        memberService.transferOwnership(conversationId, request.getNewOwnerId(), userId);
        return ResponseEntity.ok(ApiResponse.success("Ownership transferred successfully", null));
    }

    @PostMapping("/grant-admin")
    public ResponseEntity<ApiResponse<Void>> grantAdmin(
            @PathVariable UUID conversationId,
            @RequestBody GrantAdminRequest request,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        memberService.grantAdmin(conversationId, request.getUserId(), userId);
        return ResponseEntity.ok(ApiResponse.success("Admin role granted successfully", null));
    }

    @PostMapping("/revoke-admin")
    public ResponseEntity<ApiResponse<Void>> revokeAdmin(
            @PathVariable UUID conversationId,
            @RequestBody GrantAdminRequest request,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        memberService.revokeAdmin(conversationId, request.getUserId(), userId);
        return ResponseEntity.ok(ApiResponse.success("Admin role revoked successfully", null));
    }

    // ────────────────── Invitation Links ──────────────────

    @PostMapping("/invitations")
    public ResponseEntity<ApiResponse<InvitationLinkDto>> createInvitationLink(
            @PathVariable UUID conversationId,
            @RequestBody CreateInvitationLinkRequest request,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        InvitationLinkDto link = invitationLinkService.createInvitationLink(
                conversationId, userId, request.getExpiresInHours(), request.getMaxUses());
        return ResponseEntity.ok(ApiResponse.success("Invitation link created", link));
    }

    @GetMapping("/invitations")
    public ResponseEntity<List<InvitationLinkDto>> getInvitationLinks(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        List<InvitationLinkDto> links = invitationLinkService.getConversationLinks(conversationId, userId);
        return ResponseEntity.ok(links);
    }

    @DeleteMapping("/invitations/{linkId}")
    public ResponseEntity<ApiResponse<Void>> deleteInvitationLink(
            @PathVariable UUID conversationId,
            @PathVariable UUID linkId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        invitationLinkService.deleteInvitationLink(linkId, userId);
        return ResponseEntity.ok(ApiResponse.success("Invitation link deleted", null));
    }

    @PutMapping("/invitations/{linkId}/deactivate")
    public ResponseEntity<ApiResponse<Void>> deactivateInvitationLink(
            @PathVariable UUID conversationId,
            @PathVariable UUID linkId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        invitationLinkService.deactivateLink(linkId, userId);
        return ResponseEntity.ok(ApiResponse.success("Invitation link deactivated", null));
    }

    @PostMapping("/invitations/join/{linkToken}")
    public ResponseEntity<ApiResponse<Void>> joinViaInvitation(
            @PathVariable String linkToken,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        invitationLinkService.joinViaInvitationLink(linkToken, userId);
        return ResponseEntity.ok(ApiResponse.success("Joined conversation successfully", null));
    }

    // ────────────────── Helper ──────────────────

    private UUID extractUserId(Authentication authentication) {
        AppUserPrincipal userDetails = (AppUserPrincipal) authentication.getPrincipal();
        return userDetails.getUserId();
    }
}
