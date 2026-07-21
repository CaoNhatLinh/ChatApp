package com.chatapp.chat_service.message.controller;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.message.service.ReadReceiptService;
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
@RequestMapping("/api/read-receipts")
@RequiredArgsConstructor
public class ReadReceiptController {

    private final ReadReceiptService readReceiptService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Mark a message as read
     */
    @PostMapping
    public ResponseEntity<Void> markAsRead(
            @RequestParam UUID conversationId,
            @RequestParam UUID messageId) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        readReceiptService.markAsRead(conversationId, messageId, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Mark multiple messages as read (batch)
     */
    @PostMapping("/batch")
    public ResponseEntity<Void> markMultipleAsRead(
            @RequestParam UUID conversationId,
            @RequestBody List<UUID> messageIds) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        readReceiptService.markMultipleAsRead(conversationId, messageIds, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get read receipts for a message
     */
    @GetMapping
    public ResponseEntity<List<UserDTO>> getMessageReadReceipts(
            @RequestParam UUID conversationId,
            @RequestParam UUID messageId) {

        List<UserDTO> receipts = readReceiptService.getMessageReadReceipts(conversationId, messageId);
        return ResponseEntity.ok(receipts);
    }

    /**
     * Get read status for multiple messages
     */
    @PostMapping("/status")
    public ResponseEntity<Map<UUID, ReadReceiptService.ReadStatus>> getReadStatus(
            @RequestParam UUID conversationId,
            @RequestBody List<UUID> messageIds) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Map<UUID, ReadReceiptService.ReadStatus> status = readReceiptService.getReadStatusForMessages(conversationId, messageIds, userId);
        return ResponseEntity.ok(status);
    }

    /**
     * Get unread message count for a conversation
     */
    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount(@RequestParam UUID conversationId) {
        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        long count = readReceiptService.getUnreadCount(conversationId, userId);
        return ResponseEntity.ok(count);
    }
}
