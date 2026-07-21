package com.chatapp.chat_service.message.controller;

import com.chatapp.chat_service.message.service.thread.ThreadService;
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
@RequestMapping("/api/threads")
@RequiredArgsConstructor
public class ThreadController {

    private final ThreadService threadService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Get all replies to a message (thread)
     */
    @GetMapping("/{conversationId}/{parentMessageId}")
    public ResponseEntity<List<Map<String, Object>>> getThread(
            @PathVariable UUID conversationId,
            @PathVariable UUID parentMessageId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        List<Map<String, Object>> replies = threadService.getThreadPaginated(
                conversationId, parentMessageId, page, size, userId)
                .stream()
                .map(msg -> Map.of(
                        "messageId", msg.getMessageId(),
                        "content", msg.getContent(),
                        "senderId", msg.getSenderId(),
                        "senderName", msg.getSenderName(),
                        "createdAt", msg.getCreatedAt(),
                        "replyTo", msg.getReplyTo()
                ))
                .toList();

        return ResponseEntity.ok(replies);
    }

    /**
     * Get thread summary (parent + first few replies)
     */
    @GetMapping("/{conversationId}/{parentMessageId}/summary")
    public ResponseEntity<Map<String, Object>> getThreadSummary(
            @PathVariable UUID conversationId,
            @PathVariable UUID parentMessageId,
            @RequestParam(defaultValue = "3") int replyLimit) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Map<String, Object> summary = threadService.getThreadSummary(
                conversationId, parentMessageId, replyLimit, userId);

        return ResponseEntity.ok(summary);
    }

    /**
     * Get all threads in a conversation
     */
    @GetMapping("/{conversationId}/all")
    public ResponseEntity<List<Map<String, Object>>> getAllThreads(
            @PathVariable UUID conversationId) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        List<Map<String, Object>> threads = threadService.getAllThreads(conversationId, userId);
        return ResponseEntity.ok(threads);
    }

    /**
     * Delete a thread (parent message and all replies)
     */
    @DeleteMapping("/{conversationId}/{parentMessageId}")
    public ResponseEntity<Void> deleteThread(
            @PathVariable UUID conversationId,
            @PathVariable UUID parentMessageId) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        threadService.deleteThread(conversationId, parentMessageId, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get thread count
     */
    @GetMapping("/{conversationId}/{parentMessageId}/count")
    public ResponseEntity<Long> getThreadCount(
            @PathVariable UUID conversationId,
            @PathVariable UUID parentMessageId) {

        long count = threadService.getThreadCount(conversationId, parentMessageId);
        return ResponseEntity.ok(count);
    }
}
