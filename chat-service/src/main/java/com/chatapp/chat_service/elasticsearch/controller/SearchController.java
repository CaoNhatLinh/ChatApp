package com.chatapp.chat_service.elasticsearch.controller;

import com.chatapp.chat_service.elasticsearch.document.ConversationDocument;
import com.chatapp.chat_service.elasticsearch.document.MessageDocument;
import com.chatapp.chat_service.elasticsearch.service.ConversationElasticsearchService;
import com.chatapp.chat_service.elasticsearch.service.MessageElasticsearchService;
import com.chatapp.chat_service.message.service.MessageValidationService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * REST API for searching conversations and messages using Elasticsearch
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
@Slf4j
public class SearchController {

    private final ConversationElasticsearchService conversationSearchService;
    private final MessageElasticsearchService messageSearchService;
    private final MessageValidationService messageValidationService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Search conversations by name and/or type
     *
     * GET /api/search/conversations?userId={userId}&name={name}&type={type}&page=0&size=20
     */
    @GetMapping("/conversations")
    public ResponseEntity<Page<ConversationDocument>> searchConversations(
            @RequestParam UUID userId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            org.springframework.security.core.Authentication authentication) {

        UUID currentUserId = securityContextHelper.getCurrentUserId(authentication);

        // Security: Users can only search their own conversations
        if (!currentUserId.equals(userId)) {
            log.warn("User {} attempted to search conversations for user {}", currentUserId, userId);
            return ResponseEntity.status(403).build();
        }

        log.info("Searching conversations for user: {}, name: {}, type: {}", userId, name, type);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        Page<ConversationDocument> results = conversationSearchService.searchConversations(
                userId, name, type, pageable);

        return ResponseEntity.ok(results);
    }

    /**
     * Search messages in a conversation with flexible filters
     *
     * GET /api/search/messages?conversationId={id}&content={text}&senderId={id}&type={type}&page=0&size=20
     */
    @GetMapping("/messages")
    public ResponseEntity<Page<MessageDocument>> searchMessages(
            @RequestParam(required = false) UUID conversationId,
            @RequestParam(required = false) UUID recipientUserId,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) UUID senderId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) UUID mentionedUserId,
            @RequestParam(required = false) UUID replyToMessageId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            org.springframework.security.core.Authentication authentication) {

        UUID currentUserId = securityContextHelper.getCurrentUserId(authentication);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);

        if (from != null && to != null && from.isAfter(to)) {
            return ResponseEntity.badRequest().build();
        }

        List<UUID> conversationIds;
        if (conversationId != null) {
            messageValidationService.validateMessagePermission(conversationId, currentUserId);
            conversationIds = List.of(conversationId);
        } else if (recipientUserId != null) {
            conversationIds = messageValidationService.getConversationIdsForDmWithRecipient(
                    currentUserId, recipientUserId);
        } else {
            conversationIds = messageValidationService.getConversationIdsForUser(currentUserId);
        }

        Pageable pageable = PageRequest.of(safePage, safeSize);
        log.info(
                "Searching messages. conversationIds={}, conversationId={}, recipientUserId={}, content={}, senderId={}, type={}, from={}, to={}, mentionedUserId={}, replyToMessageId={}",
                conversationIds, conversationId, recipientUserId, content, senderId, type, from, to, mentionedUserId, replyToMessageId
        );

        Instant fromInstant = from != null ? from.toInstant() : null;
        Instant toInstant = to != null ? to.toInstant() : null;

        if (conversationIds.isEmpty()) {
            return ResponseEntity.ok(Page.empty(pageable));
        }

        Page<MessageDocument> results = messageSearchService.searchMessages(
                conversationIds,
                content,
                senderId,
                type,
                fromInstant,
                toInstant,
                mentionedUserId,
                replyToMessageId,
                pageable);

        return ResponseEntity.ok(results);
    }

    /**
     * Find messages mentioning a specific user
     *
     * GET /api/search/messages/mentions?conversationId={id}&userId={id}&page=0&size=20
     */
    @GetMapping("/messages/mentions")
    public ResponseEntity<Page<MessageDocument>> findMessagesMentioningUser(
            @RequestParam UUID conversationId,
            @RequestParam UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            org.springframework.security.core.Authentication authentication) {

        UUID currentUserId = securityContextHelper.getCurrentUserId(authentication);

        // Security: Users can only search mentions in conversations they are members of
        messageValidationService.validateMessagePermission(conversationId, currentUserId);

        log.info("Finding messages mentioning user: {} in conversation: {}", userId, conversationId);

        Pageable pageable = PageRequest.of(page, Math.min(Math.max(1, size), 100));
        Page<MessageDocument> results = messageSearchService.findMessagesMentioningUser(
                conversationId, userId, pageable);

        return ResponseEntity.ok(results);
    }
}
