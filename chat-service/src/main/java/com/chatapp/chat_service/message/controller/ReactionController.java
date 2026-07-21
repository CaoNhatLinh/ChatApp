package com.chatapp.chat_service.message.controller;

import com.chatapp.chat_service.message.dto.AggregatedReactionDto;
import com.chatapp.chat_service.message.dto.MessageReactionDto;
import com.chatapp.chat_service.message.service.reaction.ReactionService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/reactions")
@RequiredArgsConstructor
public class ReactionController {

    private final ReactionService reactionService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Add a reaction to a message
     */
    @PostMapping
    public ResponseEntity<MessageReactionDto> addReaction(
            @RequestParam UUID conversationId,
            @RequestParam UUID messageId,
            @RequestParam String emoji) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        MessageReactionDto reaction = reactionService.addReaction(conversationId, messageId, emoji, userId);
        return ResponseEntity.ok(reaction);
    }

    /**
     * Remove a reaction from a message
     */
    @DeleteMapping
    public ResponseEntity<Void> removeReaction(
            @RequestParam UUID conversationId,
            @RequestParam UUID messageId,
            @RequestParam String emoji) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        reactionService.removeReaction(conversationId, messageId, emoji, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get all reactions for a message
     */
    @GetMapping
    public ResponseEntity<List<AggregatedReactionDto>> getMessageReactions(
            @RequestParam UUID conversationId,
            @RequestParam UUID messageId) {

        List<AggregatedReactionDto> reactions = reactionService.getMessageReactions(conversationId, messageId);
        return ResponseEntity.ok(reactions);
    }

    /**
     * Get reactions for multiple messages (batch)
     */
    @PostMapping("/batch")
    public ResponseEntity<Map<UUID, List<AggregatedReactionDto>>> getReactionsForMessages(
            @RequestParam UUID conversationId,
            @RequestBody List<UUID> messageIds) {

        Map<UUID, List<AggregatedReactionDto>> reactions = reactionService.getReactionsForMessages(conversationId, messageIds);
        return ResponseEntity.ok(reactions);
    }
}
