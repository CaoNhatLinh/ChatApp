package com.chatapp.chat_service.message.controller;

import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.entity.MessageForward;
import com.chatapp.chat_service.message.service.forward.ForwardService;
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
@RequestMapping("/api/forwards")
@RequiredArgsConstructor
public class ForwardController {

    private final ForwardService forwardService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Forward a message to another conversation
     */
    @PostMapping
    public ResponseEntity<MessageResponseDto> forwardMessage(
            @RequestParam UUID originalConversationId,
            @RequestParam UUID originalMessageId,
            @RequestParam UUID targetConversationId,
            @RequestParam(required = false) String customContent) {

        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        MessageResponseDto forwardedMessage;
        if (customContent != null && !customContent.isEmpty()) {
            forwardedMessage = forwardService.forwardMessageWithComment(
                    originalConversationId, originalMessageId, targetConversationId, userId, customContent);
        } else {
            forwardedMessage = forwardService.forwardMessage(
                    originalConversationId, originalMessageId, targetConversationId, userId);
        }

        return ResponseEntity.ok(forwardedMessage);
    }

    /**
     * Get forward history for a message
     */
    @GetMapping("/{conversationId}/{messageId}")
    public ResponseEntity<List<MessageForward>> getForwardHistory(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId) {

        List<MessageForward> forwards = forwardService.getForwardHistory(conversationId, messageId);
        return ResponseEntity.ok(forwards);
    }

    /**
     * Get all forwards by current user
     */
    @GetMapping("/my-forwards")
    public ResponseEntity<List<MessageForward>> getMyForwards() {
        UUID userId = securityContextHelper.getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        List<MessageForward> forwards = forwardService.getForwardsByUser(userId);
        return ResponseEntity.ok(forwards);
    }

    /**
     * Check if a message is forwarded
     */
    @GetMapping("/{conversationId}/{messageId}/check")
    public ResponseEntity<Map<String, Boolean>> checkIfForwarded(
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId) {

        boolean isForwarded = forwardService.isMessageForwarded(conversationId, messageId);
        return ResponseEntity.ok(Map.of("isForwarded", isForwarded));
    }
}
