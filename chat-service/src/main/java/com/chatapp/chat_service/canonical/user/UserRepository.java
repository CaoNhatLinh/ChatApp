package com.chatapp.chat_service.canonical.user;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Persistence boundary for canonical user accounts and public profiles. */
public interface UserRepository {
    boolean claimUsername(String normalizedUsername, UUID userId, Instant now);
    boolean claimEmail(String normalizedEmail, UUID userId, Instant now);
    boolean releaseUsername(String normalizedUsername, UUID userId);
    boolean releaseEmail(String normalizedEmail, UUID userId);
    void save(CanonicalUser user);
    CanonicalUser findByUsername(String normalizedUsername);
    CanonicalUser findByEmail(String normalizedEmail);
    CanonicalUser findById(UUID userId);
    List<UserProfile> findProfilesByIds(List<UUID> userIds);
    List<UserDirectoryEntry> searchByPrefix(
            String prefix, String afterUsername, UUID afterUserId, int limit);
    CanonicalUser updateProfile(UUID userId, String displayName, String avatarUrl, Instant updatedAt);
    CanonicalUser linkExternalIdentity(UUID userId, String provider, String subject, Instant updatedAt);
    CanonicalUser updateAccountStatus(UUID userId, String accountStatus, Instant updatedAt);

    record UserProfile(UUID userId, String username, String displayName, String avatarUrl) {
    }

    record UserDirectoryEntry(
            String usernameNormalized,
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            String accountStatus) {
    }
}
