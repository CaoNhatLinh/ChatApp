package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@RestController
@RequestMapping("/api/communities")
public class CanonicalCommunityController {

    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalCommunityController(
            CanonicalBackendService backend,
            SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @GetMapping
    public CanonicalApiContracts.CommunityPage list(
            @RequestParam(defaultValue = "vi") String languageCode,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "24") int limit) {
        return backend.listCommunities(
                securityContext.getCurrentUserId(), languageCode, categoryId, tag, query, cursor, limit);
    }

    @PostMapping("/{conversationId}/join")
    public CanonicalApiContracts.CommunityJoinResponse join(@PathVariable java.util.UUID conversationId) {
        return backend.joinCommunity(securityContext.getCurrentUserId(), conversationId);
    }
}
