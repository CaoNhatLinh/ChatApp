package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.poll.PollService;
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
    private final PollService polls;
    private final SecurityContextHelper securityContext;

    public CanonicalPollController(PollService polls, SecurityContextHelper securityContext) {
        this.polls = polls;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<CanonicalApiContracts.PollView> create(
            @RequestBody CanonicalApiContracts.PollCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(polls.create(securityContext.getCurrentUserId(), request));
    }

    @PostMapping("/{pollId}/votes")
    public ResponseEntity<CanonicalApiContracts.PollView> vote(
            @PathVariable UUID pollId,
            @RequestBody CanonicalApiContracts.PollVoteRequest request) {
        return ResponseEntity.ok(polls.vote(securityContext.getCurrentUserId(), pollId, request));
    }

    @GetMapping("/{pollId}")
    public ResponseEntity<CanonicalApiContracts.PollView> get(@PathVariable UUID pollId) {
        return ResponseEntity.ok(polls.get(securityContext.getCurrentUserId(), pollId));
    }

    @DeleteMapping("/{pollId}/votes")
    public ResponseEntity<CanonicalApiContracts.PollView> removeVote(@PathVariable UUID pollId) {
        return ResponseEntity.ok(polls.removeVote(securityContext.getCurrentUserId(), pollId));
    }

    @PostMapping("/{pollId}/close")
    public ResponseEntity<CanonicalApiContracts.PollView> close(@PathVariable UUID pollId) {
        return ResponseEntity.ok(polls.close(securityContext.getCurrentUserId(), pollId));
    }
}
