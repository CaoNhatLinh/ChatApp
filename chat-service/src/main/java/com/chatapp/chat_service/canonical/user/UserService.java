package com.chatapp.chat_service.canonical.user;

import com.chatapp.chat_service.canonical.auth.UserResponseMapper;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class UserService {
    private final UserRepository users;
    private final CanonicalEventRecorder eventRecorder;

    public UserService(UserRepository users, CanonicalEventRecorder eventRecorder) {
        this.users = users;
        this.eventRecorder = eventRecorder;
    }

    public CanonicalApiContracts.PublicUserResponse getPublicUser(UUID actorId, UUID userId) {
        requireAuthenticated(actorId);
        CanonicalUser user = users.findById(userId);
        if (user == null || !"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw new NotFoundException("user not found");
        }
        return new CanonicalApiContracts.PublicUserResponse(
                user.userId(), user.username(), user.displayName(), user.avatarUrl(), user.accountStatus());
    }

    public CanonicalApiContracts.UserSearchPage searchUsers(
            UUID actorId, String rawQuery, int requestedLimit, String cursor) {
        requireAuthenticated(actorId);
        String query = normalize(rawQuery);
        if (query.length() < 2) {
            throw new BadRequestException("search query must contain at least 2 characters");
        }
        String prefix = query.substring(0, Math.min(20, query.length()));
        int limit = Math.max(1, Math.min(50, requestedLimit));
        UserCursor decoded = decodeCursor(cursor);
        var rows = users.searchByPrefix(
                prefix,
                decoded == null ? null : decoded.username(),
                decoded == null ? null : decoded.userId(),
                limit + 1);
        boolean hasNext = rows.size() > limit;
        var pageRows = hasNext ? rows.subList(0, limit) : rows;
        var content = pageRows.stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(row.accountStatus()))
                .map(row -> new CanonicalApiContracts.PublicUserResponse(
                        row.userId(), row.username(), row.displayName(), row.avatarUrl(), row.accountStatus()))
                .toList();
        String nextCursor = hasNext ? encodeCursor(pageRows.get(pageRows.size() - 1)) : null;
        return new CanonicalApiContracts.UserSearchPage(content, nextCursor, hasNext);
    }

    public CanonicalApiContracts.UserResponse updateProfile(
            UUID actorId, CanonicalApiContracts.UpdateProfileRequest request) {
        requireAuthenticated(actorId);
        CanonicalUser current = users.findById(actorId);
        if (current == null) {
            throw new NotFoundException("user not found");
        }
        CanonicalUser updated = users.updateProfile(
                actorId, request.displayName().trim(), request.avatarUrl(), Instant.now());
        eventRecorder.record(
                actorId, null, "USER_PROFILE_UPDATE", "user", actorId.toString(), actorId, null,
                Map.of("displayName", current.displayName()),
                Map.of("displayName", updated.displayName()));
        return UserResponseMapper.toUserResponse(updated);
    }

    private void requireAuthenticated(UUID actorId) {
        if (actorId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    private String encodeCursor(UserRepository.UserDirectoryEntry row) {
        String value = row.usernameNormalized() + "|" + row.userId();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private UserCursor decodeCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = value.lastIndexOf('|');
            if (separator <= 0 || separator == value.length() - 1) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new UserCursor(value.substring(0, separator), UUID.fromString(value.substring(separator + 1)));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("invalid user search cursor");
        }
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
    }

    private record UserCursor(String username, UUID userId) {
    }
}
