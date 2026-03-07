package com.chatapp.chat_service.elasticsearch.controller;

import com.chatapp.chat_service.elasticsearch.document.ConversationDocument;
import com.chatapp.chat_service.elasticsearch.document.MessageDocument;
import com.chatapp.chat_service.elasticsearch.service.ConversationElasticsearchService;
import com.chatapp.chat_service.elasticsearch.service.MessageElasticsearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
            @RequestParam(defaultValue = "20") int size) {
        
        log.info("Searching conversations for user: {}, name: {}, type: {}", userId, name, type);
        Pageable pageable = PageRequest.of(page, size);
        Page<ConversationDocument> results = conversationSearchService.searchConversations(
                userId, name, type, pageable);
        
        return ResponseEntity.ok(results);
    }

    /**
     * Search messages in a conversation with flexible filters
     * 
     * GET /api/search/messages?conversationId={id}&content={text}&senderId={id}&type={type}&page=0&size=20
     * 
     * Examples:
     * - Search by content: ?conversationId=xxx&content=hello
     * - Filter by sender: ?conversationId=xxx&senderId=yyy
     * - Filter by type: ?conversationId=xxx&type=IMAGE
     * - Combined: ?conversationId=xxx&content=hello&senderId=yyy&type=TEXT
     */
    @GetMapping("/messages")
    public ResponseEntity<Page<MessageDocument>> searchMessages(
            @RequestParam UUID conversationId,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) UUID senderId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        log.info("Searching messages in conversation: {}, content: {}, senderId: {}, type: {}", 
                conversationId, content, senderId, type);
        
        Pageable pageable = PageRequest.of(page, size);
        Page<MessageDocument> results = messageSearchService.searchMessages(
                conversationId, content, senderId, type, pageable);
        
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
            @RequestParam(defaultValue = "20") int size) {
        
        log.info("Finding messages mentioning user: {} in conversation: {}", userId, conversationId);
        
        Pageable pageable = PageRequest.of(page, size);
        Page<MessageDocument> results = messageSearchService.findMessagesMentioningUser(
                conversationId, userId, pageable);
        
        return ResponseEntity.ok(results);
    }
}
