package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/polls")
public class CanonicalPollController {
    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalPollController(CanonicalBackendService backend, SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalApiContracts.PollView> create(
            @RequestBody CanonicalApiContracts.PollCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(backend.createPoll(securityContext.getCurrentUserId(), request));
    }

    @PostMapping("/{pollId}/votes")
    public ResponseEntity<CanonicalApiContracts.PollView> vote(
            @PathVariable UUID pollId,
            @RequestBody CanonicalApiContracts.PollVoteRequest request) {
        return ResponseEntity.ok(backend.votePoll(securityContext.getCurrentUserId(), pollId, request));
    }

    @GetMapping("/{pollId}")
    public ResponseEntity<CanonicalApiContracts.PollView> get(@PathVariable UUID pollId) {
        return ResponseEntity.ok(backend.getPoll(securityContext.getCurrentUserId(), pollId));
    }

    @DeleteMapping("/{pollId}/votes")
    public ResponseEntity<CanonicalApiContracts.PollView> removeVote(@PathVariable UUID pollId) {
        return ResponseEntity.ok(backend.removePollVote(securityContext.getCurrentUserId(), pollId));
    }

    @PostMapping("/{pollId}/close")
    public ResponseEntity<CanonicalApiContracts.PollView> close(@PathVariable UUID pollId) {
        return ResponseEntity.ok(backend.closePoll(securityContext.getCurrentUserId(), pollId));
    }
}
