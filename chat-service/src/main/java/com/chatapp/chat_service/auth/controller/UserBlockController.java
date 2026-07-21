package com.chatapp.chat_service.auth.controller;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserBlockService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/blocks")
@RequiredArgsConstructor
public class UserBlockController {

    private final UserBlockService userBlockService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Block a user
     */
    @PostMapping
    public ResponseEntity<Void> blockUser(
            @RequestParam UUID blockedUserId,
            @RequestParam(required = false) String reason) {

        UUID blockerId = securityContextHelper.getCurrentUserId();
        if (blockerId == null) {
            return ResponseEntity.status(401).build();
        }

        userBlockService.blockUser(blockerId, blockedUserId, reason);
        return ResponseEntity.ok().build();
    }

    /**
     * Unblock a user
     */
    @DeleteMapping
    public ResponseEntity<Void> unblockUser(@RequestParam UUID blockedUserId) {
        UUID blockerId = securityContextHelper.getCurrentUserId();
        if (blockerId == null) {
            return ResponseEntity.status(401).build();
        }

        userBlockService.unblockUser(blockerId, blockedUserId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get all blocked users
     */
    @GetMapping
    public ResponseEntity<List<UserDTO>> getBlockedUsers() {
        UUID blockerId = securityContextHelper.getCurrentUserId();
        if (blockerId == null) {
            return ResponseEntity.status(401).build();
        }

        List<UserDTO> blockedUsers = userBlockService.getBlockedUsers(blockerId);
        return ResponseEntity.ok(blockedUsers);
    }

    /**
     * Check if a user is blocked
     */
    @GetMapping("/check")
    public ResponseEntity<Boolean> isBlocked(@RequestParam UUID blockedUserId) {
        UUID blockerId = securityContextHelper.getCurrentUserId();
        if (blockerId == null) {
            return ResponseEntity.status(401).build();
        }

        boolean blocked = userBlockService.isBlocked(blockerId, blockedUserId);
        return ResponseEntity.ok(blocked);
    }
}
