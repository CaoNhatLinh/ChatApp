package com.chatapp.chat_service.canonical.auth;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.notification.NotificationRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final NotificationRepository notifications;

    public AuthService(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider,
            NotificationRepository notifications) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.notifications = notifications;
    }

    public CanonicalApiContracts.UserResponse register(CanonicalApiContracts.RegisterRequest request) {
        Instant now = Instant.now();
        String username = request.username();
        String email = request.email();
        if (!StringUtils.hasText(username) || !StringUtils.hasText(email)) {
            throw new BadRequestException("username and email are required");
        }
        if (!StringUtils.hasText(request.password()) || request.password().length() < 8) {
            throw new BadRequestException("password must have at least 8 chars");
        }

        String normalizedUsername = normalize(username);
        String normalizedEmail = normalize(email);
        UUID userId = UUID.randomUUID();
        if (!users.claimUsername(normalizedUsername, userId, now)) {
            throw new ConflictException("username already exists");
        }
        if (!users.claimEmail(normalizedEmail, userId, now)) {
            users.releaseUsername(normalizedUsername, userId);
            throw new ConflictException("email already exists");
        }

        boolean userSaved = false;
        try {
            CanonicalUser user = new CanonicalUser(
                    userId, username.trim(), normalizedUsername, email.trim(), normalizedEmail,
                    passwordEncoder.encode(request.password()),
                    "LOCAL", null, request.displayName(), null, "ACTIVE", now, now, null);
            users.save(user);
            userSaved = true;
            notifications.saveSettings(new CanonicalNotificationSettings(
                    userId, "ALL", true, true, true, true, null, null, "UTC", now));
            return UserResponseMapper.toUserResponse(user);
        } catch (RuntimeException failure) {
            if (!userSaved) {
                users.releaseEmail(normalizedEmail, userId);
                users.releaseUsername(normalizedUsername, userId);
            }
            throw failure;
        }
    }

    public CanonicalApiContracts.AuthResponse login(CanonicalApiContracts.LoginRequest request) {
        if (!StringUtils.hasText(request.username()) || !StringUtils.hasText(request.password())) {
            throw new BadRequestException("username/password required");
        }
        CanonicalUser user = users.findByUsername(normalize(request.username()));
        if (user == null || user.passwordHash() == null
                || !passwordEncoder.matches(request.password(), user.passwordHash())) {
            throw new ForbiddenException("invalid credentials");
        }
        if (!"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw new ForbiddenException("account is not active");
        }
        String accessToken = tokenProvider.generateToken(user.username(), user.userId());
        return new CanonicalApiContracts.AuthResponse(
                accessToken, UserResponseMapper.toUserResponse(user));
    }

    public CanonicalApiContracts.UserResponse me(UUID userId) {
        CanonicalUser user = users.findById(userId);
        if (user == null) {
            throw new NotFoundException("user not found");
        }
        return UserResponseMapper.toUserResponse(user);
    }

    private String normalize(String input) {
        return StringUtils.hasText(input) ? input.trim().toLowerCase(Locale.ROOT) : "";
    }

}
