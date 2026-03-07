package com.chatapp.chat_service.auth.controller;

import com.chatapp.chat_service.auth.dto.AuthResponse;
import com.chatapp.chat_service.auth.dto.LoginRequest;
import com.chatapp.chat_service.auth.dto.RegisterRequest;
import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.AuthService;

import com.chatapp.chat_service.security.core.AppUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            authService.logout(token);
        }
        return ResponseEntity.ok().build();
    }
    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody RegisterRequest RegisterRequest) {
        UserDTO savedUser = authService.register(RegisterRequest);
        return ResponseEntity.ok(savedUser);
    }
    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        
        Object principal = authentication.getPrincipal();
        
        if (principal instanceof AppUserPrincipal) {
            AppUserPrincipal userDetails = (AppUserPrincipal) principal;
            return ResponseEntity.ok(authService.getCurrentUser(userDetails.getUsername()));
        }
        
        return ResponseEntity.status(401).build();
    }
}

