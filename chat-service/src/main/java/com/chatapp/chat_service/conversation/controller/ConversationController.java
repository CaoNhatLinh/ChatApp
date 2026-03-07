package com.chatapp.chat_service.conversation.controller;

import com.chatapp.chat_service.common.dto.ApiResponse;
import com.chatapp.chat_service.conversation.dto.ConversationRequest;
import com.chatapp.chat_service.conversation.dto.ConversationResponseDto;
import com.chatapp.chat_service.conversation.dto.ConversationSearchDto;
import com.chatapp.chat_service.conversation.dto.UpdateConversationRequest;
import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.conversation.service.ConversationService;

import com.chatapp.chat_service.security.core.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    // ────────────────── GET endpoints ──────────────────

    @GetMapping
    public ResponseEntity<org.springframework.data.domain.Slice<ConversationResponseDto>> getAllConversations(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return getMyConversations(authentication, PageRequest.of(page, size));
    }

    @GetMapping("/my")
    public ResponseEntity<org.springframework.data.domain.Slice<ConversationResponseDto>> getMyConversations(
            Authentication authentication,
            Pageable pageable) {
        UUID userId = extractUserId(authentication);
        org.springframework.data.domain.Slice<ConversationResponseDto> conversations =
                conversationService.getUserConversationsWithDetails(userId, pageable);
        return ResponseEntity.ok(conversations);
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<ConversationResponseDto>> getConversationById(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);

        Optional<Conversation> conversation = conversationService.getConversationById(conversationId);

        if (conversation.isPresent()) {
            ConversationResponseDto responseDto = conversationService.buildSingleConversationResponse(
                    conversation.get(), userId);
            if (responseDto != null) {
                return ResponseEntity.ok(ApiResponse.success("Conversation found", responseDto));
            }
            return ResponseEntity.status(404).body(ApiResponse.error(404, "User is not a member of this conversation"));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "Conversation not found"));
    }

    @GetMapping("/dm")
    public ResponseEntity<ApiResponse<ConversationResponseDto>> findPrivateConversation(
            @RequestParam UUID userId1,
            @RequestParam UUID userId2,
            Authentication authentication) {
        UUID currentUserId = extractUserId(authentication);
        Optional<Conversation> conversation = conversationService.findPrivateConversationWithCache(userId1, userId2);

        if (conversation.isPresent()) {
            ConversationResponseDto dto = conversationService.buildSingleConversationResponse(
                    conversation.get(), currentUserId);
            return ResponseEntity.ok(ApiResponse.success("DM conversation found", dto));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "DM conversation not found"));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<ConversationSearchDto>> searchConversations(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String type,
            Pageable pageable,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        Page<ConversationSearchDto> results = conversationService.searchConversations(userId, name, type, pageable);
        return ResponseEntity.ok(results);
    }

    // ────────────────── POST endpoints ──────────────────

    @PostMapping
    public ResponseEntity<ApiResponse<ConversationResponseDto>> createConversation(
            @RequestBody ConversationRequest conversationRequest,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        Conversation created = conversationService.createConversation(conversationRequest, userId);
        ConversationResponseDto dto = conversationService.buildSingleConversationResponse(created, userId);
        return ResponseEntity.ok(ApiResponse.success("Conversation created", dto));
    }

    // ────────────────── PUT endpoints ──────────────────

    @PutMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<ConversationResponseDto>> updateConversation(
            @PathVariable UUID conversationId,
            @RequestBody UpdateConversationRequest request,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);

        Conversation updatedConversation = conversationService.updateConversation(
                conversationId,
                request.getName(),
                request.getDescription(),
                request.getBackgroundUrl(),
                userId
        );
        ConversationResponseDto dto = conversationService.buildSingleConversationResponse(
                updatedConversation, userId);
        return ResponseEntity.ok(ApiResponse.success("Conversation updated", dto));
    }

    @PutMapping("/{conversationId}/restore")
    public ResponseEntity<ApiResponse<Void>> restoreConversation(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        boolean restored = conversationService.restoreConversation(conversationId, userId);

        if (restored) {
            return ResponseEntity.ok(ApiResponse.success("Conversation restored", null));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "Conversation not found"));
    }

    @PutMapping("/{conversationId}/pin")
    public ResponseEntity<ApiResponse<Void>> pinConversation(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        boolean pinned = conversationService.pinConversation(conversationId, userId);
        if (pinned) {
            return ResponseEntity.ok(ApiResponse.success("Conversation pinned", null));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "Conversation not found"));
    }

    @PutMapping("/{conversationId}/unpin")
    public ResponseEntity<ApiResponse<Void>> unpinConversation(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        boolean unpinned = conversationService.unpinConversation(conversationId, userId);
        if (unpinned) {
            return ResponseEntity.ok(ApiResponse.success("Conversation unpinned", null));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "Conversation not found"));
    }

    // ────────────────── DELETE endpoints ──────────────────

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<Void>> deleteConversation(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        boolean deleted = conversationService.deleteConversation(conversationId, userId);

        if (deleted) {
            return ResponseEntity.ok(ApiResponse.success("Conversation deleted", null));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "Conversation not found"));
    }

    @DeleteMapping("/{conversationId}/permanent")
    public ResponseEntity<ApiResponse<Void>> permanentDeleteConversation(
            @PathVariable UUID conversationId,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        boolean deleted = conversationService.permanentDeleteConversation(conversationId, userId);

        if (deleted) {
            return ResponseEntity.ok(ApiResponse.success("Conversation permanently deleted", null));
        }
        return ResponseEntity.status(404).body(ApiResponse.error(404, "Conversation not found"));
    }

    // ────────────────── Helper ──────────────────

    private UUID extractUserId(Authentication authentication) {
        AppUserPrincipal userDetails = (AppUserPrincipal) authentication.getPrincipal();
        return userDetails.getUserId();
    }
}