package com.chatapp.chat_service.message.controller;

import com.chatapp.chat_service.common.dto.ApiResponse;
import com.chatapp.chat_service.message.dto.AggregatedReactionDto;
import com.chatapp.chat_service.message.dto.MessageAttachmentDto;
import com.chatapp.chat_service.message.dto.MessageReactionDto;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.dto.MessageRevisionDto;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.dto.UpdateMessageRequest;
import com.chatapp.chat_service.message.entity.MessageReadReceipt;
import com.chatapp.chat_service.message.entity.PinnedMessage;
import com.chatapp.chat_service.message.service.MessageEnhancementService;
import com.chatapp.chat_service.message.service.MessageService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final MessageEnhancementService enhancementService;
    private final SecurityContextHelper securityContextHelper;

    @PostMapping
    public ResponseEntity<MessageResponseDto> sendMessage(@Valid @RequestBody MessageRequest request, Authentication authentication) {
        UUID senderId = securityContextHelper.getCurrentUserId(authentication);
        request.setSenderId(senderId);
        MessageResponseDto response = messageService.sendMessage(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Láº¥y tin nháº¯n má»›i nháº¥t cá»§a conversation
     * GET /api/messages/{conversationId}?size=20&page=0
     */
    @GetMapping("/{conversationId}")
    public ResponseEntity<org.springframework.data.domain.Slice<MessageResponseDto>> getMessages(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "0") int page,
            Authentication authentication
    ) {
        securityContextHelper.getCurrentUserId(authentication);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100));
        return ResponseEntity.ok(
                messageService.getLatestMessages(conversationId, pageable)
        );
    }

    /**
     * Láº¥y tin nháº¯n má»›i nháº¥t cá»§a conversation (API Ä‘Æ¡n giáº£n)
     * GET /api/messages/conversations/{conversationId}?limit=20
     */
    @GetMapping("/conversations/{conversationId}")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Slice<MessageResponseDto>>> getConversationMessages(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "20") int limit,
            Authentication authentication
    ) {
        securityContextHelper.getCurrentUserId(authentication);
        Pageable pageable = PageRequest.of(0, Math.min(limit, 100));
        org.springframework.data.domain.Slice<MessageResponseDto> messages = messageService.getLatestMessages(conversationId, pageable);

        ApiResponse<org.springframework.data.domain.Slice<MessageResponseDto>> response = ApiResponse.success(
                "Get messages of conversation successfully",
                messages
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Láº¥y tin nháº¯n cÅ© hÆ¡n má»™t message nháº¥t Ä‘á»‹nh (pagination thá»§ cÃ´ng)
     * GET /api/messages/conversations/{conversationId}/older?beforeMessageId={messageId}
     */
    @GetMapping("/conversations/{conversationId}/older")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Slice<MessageResponseDto>>> getOlderMessages(
            @PathVariable UUID conversationId,
            @RequestParam UUID beforeMessageId,
            @RequestParam(defaultValue = "20") int limit,
            Authentication authentication
    ) {
        securityContextHelper.getCurrentUserId(authentication);
        Pageable pageable = PageRequest.of(0, limit);
        org.springframework.data.domain.Slice<MessageResponseDto> messages = messageService.getOlderMessages(conversationId, beforeMessageId, pageable);

        ApiResponse<org.springframework.data.domain.Slice<MessageResponseDto>> response = ApiResponse.success(
                "Get older messages successfully",
                messages
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Láº¥y tin nháº¯n vá»›i filter thá»i gian
     * GET /api/messages/conversations/{conversationId}/filtered?before=2024-01-01T10:00:00&after=2024-01-01T09:00:00&size=20
     */
    @GetMapping("/conversations/{conversationId}/filtered")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Slice<MessageResponseDto>>> getFilteredMessages(
            @PathVariable UUID conversationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime before,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime after,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "0") int page,
            Authentication authentication
    ) {
        securityContextHelper.getCurrentUserId(authentication);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100));
        org.springframework.data.domain.Slice<MessageResponseDto> messages = messageService.getConversationMessages(conversationId, before, after, pageable);

        ApiResponse<org.springframework.data.domain.Slice<MessageResponseDto>> response = ApiResponse.success(
                "Get filtered messages successfully",
                messages
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{conversationId}/{messageId}/attachments")
    public ResponseEntity<MessageAttachmentDto> addAttachment(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestBody MessageAttachmentDto attachmentDto,
            Authentication authentication
    ) {
        UUID userId = securityContextHelper.getCurrentUserId(authentication);
        MessageAttachmentDto result = enhancementService.addAttachment(conversationId, messageId, attachmentDto, userId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{conversationId}/{messageId}/attachments")
    public ResponseEntity<List<MessageAttachmentDto>> getMessageAttachments(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID userId = securityContextHelper.getCurrentUserId(authentication);
        List<MessageAttachmentDto> attachments = enhancementService.getMessageAttachments(conversationId, messageId, userId);
        return ResponseEntity.ok(attachments);
    }


    @PostMapping("/{conversationId}/{messageId}/reactions/{emoji}")
    public ResponseEntity<Void> toggleReaction(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @PathVariable String emoji,
            Authentication authentication
    ) {
        UUID userId = securityContextHelper.getCurrentUserId(authentication);
        enhancementService.toggleReaction(conversationId, messageId, emoji, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{conversationId}/{messageId}/reactions")
    public ResponseEntity<List<AggregatedReactionDto>> getMessageReactions(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID currentUserId = securityContextHelper.getCurrentUserId(authentication);
        List<AggregatedReactionDto> reactions = enhancementService.getMessageReactions(conversationId, messageId, currentUserId);
        return ResponseEntity.ok(reactions);
    }

    @PostMapping("/{conversationId}/{messageId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID readerId = securityContextHelper.getCurrentUserId(authentication);
        enhancementService.markAsRead(conversationId, messageId, readerId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{conversationId}/{messageId}")
    public ResponseEntity<MessageResponseDto> editMessage(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @RequestBody UpdateMessageRequest request,
            Authentication authentication
    ) {
        UUID editorId = securityContextHelper.getCurrentUserId(authentication);
        return ResponseEntity.ok(messageService.editMessage(conversationId, messageId, request.getContent(), editorId));
    }

    @DeleteMapping("/{conversationId}/{messageId}")
    public ResponseEntity<MessageResponseDto> deleteMessage(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID requesterId = securityContextHelper.getCurrentUserId(authentication);
        return ResponseEntity.ok(messageService.deleteMessage(conversationId, messageId, requesterId));
    }

    @GetMapping("/{conversationId}/{messageId}/revisions")
    public ResponseEntity<List<MessageRevisionDto>> getMessageRevisions(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID requesterId = securityContextHelper.getCurrentUserId(authentication);
        return ResponseEntity.ok(messageService.getMessageRevisions(conversationId, messageId, requesterId));
    }

    @GetMapping("/{conversationId}/{messageId}/read-receipts")
    public ResponseEntity<List<MessageReadReceipt>> getReadReceipts(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID userId = securityContextHelper.getCurrentUserId(authentication);
        List<MessageReadReceipt> receipts = enhancementService.getMessageReadReceipts(conversationId, messageId, userId);
        return ResponseEntity.ok(receipts);
    }


    @PostMapping("/{conversationId}/{messageId}/pin")
    public ResponseEntity<Void> togglePinMessage(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            Authentication authentication
    ) {
        UUID pinnedBy = securityContextHelper.getCurrentUserId(authentication);
        enhancementService.togglePinMessage(conversationId, messageId, pinnedBy);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{conversationId}/pinned")
    public ResponseEntity<List<PinnedMessage>> getPinnedMessages(
            @PathVariable UUID conversationId,
            Authentication authentication
    ) {
        UUID userId = securityContextHelper.getCurrentUserId(authentication);
        List<PinnedMessage> pinnedMessages = enhancementService.getPinnedMessages(conversationId, userId);
        return ResponseEntity.ok(pinnedMessages);
    }

    /**
     * Test endpoint Ä‘á»ƒ debug pagination issue
     * GET /api/messages/conversations/{conversationId}/debug?limit=20&method=custom
     */
    @GetMapping("/conversations/{conversationId}/debug")
    public ResponseEntity<ApiResponse<Object>> debugMessages(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "custom") String method
    ) {
        Pageable pageable = PageRequest.of(0, Math.min(limit, 100));

        List<MessageResponseDto> messages;
        String methodUsed;

        if ("derived".equals(method)) {
            messages = messageService.getLatestMessages(conversationId, pageable).getContent();
            methodUsed = "Derived Query Method";
        } else {
            messages = messageService.getLatestMessages(conversationId, pageable).getContent();
            methodUsed = "Custom @Query with LIMIT";
        }

        Object debugInfo = Map.of(
                "method", methodUsed,
                "requestedLimit", limit,
                "actualCount", messages.size(),
                "messages", messages
        );

        ApiResponse<Object> response = ApiResponse.success(
                "Debug messages - " + methodUsed,
                debugInfo
        );

        return ResponseEntity.ok(response);
    }
}
