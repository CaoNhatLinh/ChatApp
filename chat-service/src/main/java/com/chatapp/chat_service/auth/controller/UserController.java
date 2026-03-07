package com.chatapp.chat_service.auth.controller;

import com.chatapp.chat_service.auth.dto.UpdateProfileRequest;
import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.security.core.AppUserPrincipal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/search")
    public ResponseEntity<UserDTO> searchUsers(@RequestParam String q) {
        return ResponseEntity.ok(userService.findByUsername(q));
    }

    @PatchMapping("/profile")
    public ResponseEntity<UserDTO> updateProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication
    ) {
        UUID userId = ((AppUserPrincipal) authentication.getPrincipal()).getUserId();
        return ResponseEntity.ok(userService.updateProfile(userId, request));
    }

    @GetMapping("/profile/{userId}")
    public ResponseEntity<UserDTO> getUserProfile(
            @PathVariable UUID userId
    ) {
        return ResponseEntity.ok(userService.getUserProfile(userId));
    }
}