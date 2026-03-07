package com.chatapp.chat_service.auth.service;

import com.chatapp.chat_service.auth.dto.AuthResponse;
import com.chatapp.chat_service.auth.dto.LoginRequest;
import com.chatapp.chat_service.auth.dto.RegisterRequest;
import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Clean AuthService
 * - Login: authenticate + generate token
 * - Register: validate + hash password + save
 * - Logout: token invalidation (presence managed by WebSocket connect/disconnect)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    /**
     * Authenticate user & generate JWT token
     */
    public AuthResponse login(LoginRequest request) {
        log.info("Login attempt for user: {}", request.getUsername());

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );

            User user = userRepository.findFirstByUsername(request.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            String token = tokenProvider.generateToken(user.getUsername(), user.getUserId());


            log.info("Login successful for user: {}", request.getUsername());

            return new AuthResponse(token, user.getUserId(), user.getUsername());

        } catch (BadCredentialsException ex) {
            log.warn("Login failed - bad credentials for user: {}", request.getUsername());
            throw new BadRequestException("Invalid username or password");
        } catch (AuthenticationException ex) {
            log.warn("Login failed - authentication error for user: {}: {}", request.getUsername(), ex.getMessage());
            throw new BadRequestException("Authentication failed");
        } catch (RuntimeException ex) {
            log.error("Login failed - unexpected error for user: {}: {}", request.getUsername(), ex.getMessage(), ex);
            throw ex;
        }
    }

    /**
     * Register new user
     */
    public UserDTO register(RegisterRequest request) {
        log.info("Register attempt for user: {}", request.getUsername());

        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new BadRequestException("Username cannot be empty");
        }

        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new BadRequestException("Password must be at least 6 characters");
        }

        if (userRepository.existsByUsername(request.getUsername())) {
            log.warn("Username already exists: {}", request.getUsername());
            throw new BadRequestException("Username already exists");
        }

        User user = User.builder()
                .userId(UUID.randomUUID())
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName())
                .createdAt(java.time.Instant.now())
                .build();

        User savedUser = userRepository.save(user);

        log.info("User registered successfully: {}", request.getUsername());

        return UserDTO.builder()
                .userId(savedUser.getUserId())
                .userName(savedUser.getUsername())
                .displayName(savedUser.getDisplayName())
                .avatarUrl(savedUser.getAvatarUrl())
                .statusPreference("ONLINE")
                .build();
    }

    /**
     * Logout user & clear presence
     */
    public void logout(String token) {
        try {
            String username = tokenProvider.extractUsername(token);
            log.info("User logged out: {}", username);
        } catch (Exception ex) {
            log.warn("Logout error: {}", ex.getMessage());
        }
    }

    /**
     * Get current user DTO
     */
    public UserDTO getCurrentUser(String username) {
        User user = userRepository.findFirstByUsername(username)
                .orElseThrow(() -> {
                    log.warn("User not found: {}", username);
                    return new RuntimeException("User not found");
                });

        return UserDTO.builder()
                .userId(user.getUserId())
                .userName(user.getUsername())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .statusPreference(user.getStatusPreference() != null ? user.getStatusPreference() : "ONLINE")
                .build();
    }
}