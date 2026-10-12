package com.chatapp.chat_service.canonical.user;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class CassandraUserRepository implements UserRepository {
    private final CqlSession session;
    private final PreparedStatement claimUsername;
    private final PreparedStatement claimEmail;
    private final PreparedStatement releaseUsername;
    private final PreparedStatement releaseEmail;
    private final PreparedStatement saveUser;
    private final PreparedStatement findUserIdByUsername;
    private final PreparedStatement findUserIdByEmail;
    private final PreparedStatement findUserById;
    private final PreparedStatement findProfilesByIds;
    private final PreparedStatement saveDirectoryEntry;
    private final PreparedStatement findDirectory;
    private final PreparedStatement findDirectoryAfter;
    private final PreparedStatement updateProfile;
    private final PreparedStatement linkExternalIdentity;
    private final PreparedStatement updateDirectoryProfile;
    private final PreparedStatement updateAccountStatus;
    private final PreparedStatement findSecurityVersion;
    private final PreparedStatement updateDirectoryStatus;

    public CassandraUserRepository(CqlSession session) {
        this.session = session;
        this.claimUsername = session.prepare("""
                INSERT INTO user_id_by_username (username_normalized, user_id, created_at)
                VALUES (?, ?, ?) IF NOT EXISTS
                """);
        this.claimEmail = session.prepare("""
                INSERT INTO user_id_by_email (email_normalized, user_id, created_at)
                VALUES (?, ?, ?) IF NOT EXISTS
                """);
        this.releaseUsername = session.prepare("""
                DELETE FROM user_id_by_username WHERE username_normalized = ? IF user_id = ?
                """);
        this.releaseEmail = session.prepare("""
                DELETE FROM user_id_by_email WHERE email_normalized = ? IF user_id = ?
                """);
        this.saveUser = session.prepare("""
                INSERT INTO users_by_id
                    (user_id, username, username_normalized, email, email_normalized, password_hash,
                     auth_provider, external_subject, display_name, avatar_url, avatar_asset_id,
                     account_status, email_verified_at, locale, timezone, security_version,
                     created_at, updated_at, last_login_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                """);
        this.findUserIdByUsername = session.prepare(
                "SELECT user_id FROM user_id_by_username WHERE username_normalized = ?");
        this.findUserIdByEmail = session.prepare(
                "SELECT user_id FROM user_id_by_email WHERE email_normalized = ?");
        this.findUserById = session.prepare("SELECT * FROM users_by_id WHERE user_id = ?");
        this.findProfilesByIds = session.prepare(
                "SELECT user_id, username, display_name, avatar_url FROM users_by_id WHERE user_id IN ?");
        this.saveDirectoryEntry = session.prepare("""
                INSERT INTO users_by_username_prefix
                    (username_prefix, username_normalized, user_id, username, display_name, avatar_url, account_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """);
        this.findDirectory = session.prepare("""
                SELECT username_normalized, user_id, username, display_name, avatar_url, account_status
                FROM users_by_username_prefix WHERE username_prefix = ? LIMIT ?
                """);
        this.findDirectoryAfter = session.prepare("""
                SELECT username_normalized, user_id, username, display_name, avatar_url, account_status
                FROM users_by_username_prefix
                WHERE username_prefix = ? AND (username_normalized, user_id) > (?, ?) LIMIT ?
                """);
        this.updateProfile = session.prepare("""
                UPDATE users_by_id SET display_name = ?, avatar_url = ?, updated_at = ? WHERE user_id = ?
                """);
        this.linkExternalIdentity = session.prepare("""
                UPDATE users_by_id SET auth_provider = ?, external_subject = ?, updated_at = ?
                WHERE user_id = ?
                """);
        this.updateDirectoryProfile = session.prepare("""
                UPDATE users_by_username_prefix SET display_name = ?, avatar_url = ?
                WHERE username_prefix = ? AND username_normalized = ? AND user_id = ?
                """);
        this.findSecurityVersion = session.prepare(
                "SELECT security_version FROM users_by_id WHERE user_id = ?");
        this.updateAccountStatus = session.prepare("""
                UPDATE users_by_id SET account_status = ?, security_version = ?, updated_at = ?
                WHERE user_id = ? IF security_version = ?
                """);
        this.updateDirectoryStatus = session.prepare("""
                UPDATE users_by_username_prefix SET account_status = ?
                WHERE username_prefix = ? AND username_normalized = ? AND user_id = ?
                """);
    }

    @Override public boolean claimUsername(String value, UUID userId, Instant now) {
        var row = session.execute(claimUsername.bind(value, userId, now)).one();
        return row != null && (row.getBoolean("[applied]") || userId.equals(row.getUuid("user_id")));
    }

    @Override public boolean claimEmail(String value, UUID userId, Instant now) {
        var row = session.execute(claimEmail.bind(value, userId, now)).one();
        return row != null && (row.getBoolean("[applied]") || userId.equals(row.getUuid("user_id")));
    }

    @Override public boolean releaseUsername(String value, UUID userId) {
        return session.execute(releaseUsername.bind(value, userId)).wasApplied();
    }

    @Override public boolean releaseEmail(String value, UUID userId) {
        return session.execute(releaseEmail.bind(value, userId)).wasApplied();
    }

    @Override public void save(CanonicalUser user) {
        session.execute(saveUser.bind(
                user.userId(), user.username(), user.usernameNormalized(), user.email(), user.emailNormalized(),
                user.passwordHash(), user.authProvider(), user.externalSubject(), user.displayName(), user.avatarUrl(),
                null, user.accountStatus(), null, null, "UTC", user.createdAt(), user.updatedAt(),
                user.lastLoginAt(), null));
        var batch = BatchStatement.builder(BatchType.UNLOGGED);
        for (String prefix : prefixes(user.usernameNormalized())) {
            batch.addStatement(saveDirectoryEntry.bind(
                    prefix, user.usernameNormalized(), user.userId(), user.username(), user.displayName(),
                    user.avatarUrl(), user.accountStatus()));
        }
        session.execute(batch.build());
    }

    @Override public CanonicalUser findByUsername(String normalizedUsername) {
        var row = session.execute(findUserIdByUsername.bind(normalizedUsername)).one();
        return row == null ? null : findById(row.getUuid("user_id"));
    }

    @Override public CanonicalUser findByEmail(String normalizedEmail) {
        var row = session.execute(findUserIdByEmail.bind(normalizedEmail)).one();
        return row == null ? null : findById(row.getUuid("user_id"));
    }

    @Override public CanonicalUser findById(UUID userId) {
        var row = session.execute(findUserById.bind(userId)).one();
        return row == null ? null : new CanonicalUser(
                row.getUuid("user_id"), row.getString("username"), row.getString("username_normalized"),
                row.getString("email"), row.getString("email_normalized"), row.getString("password_hash"),
                row.getString("auth_provider"), row.getString("external_subject"), row.getString("display_name"),
                row.getString("avatar_url"), row.getString("account_status"), row.getInstant("created_at"),
                row.getInstant("updated_at"), row.getInstant("last_login_at"));
    }

    @Override public List<UserProfile> findProfilesByIds(List<UUID> userIds) {
        if (userIds.isEmpty()) return List.of();
        return session.execute(findProfilesByIds.bind(userIds)).all().stream()
                .map(row -> new UserProfile(row.getUuid("user_id"), row.getString("username"),
                        row.getString("display_name"), row.getString("avatar_url")))
                .toList();
    }

    @Override public List<UserDirectoryEntry> searchByPrefix(
            String prefix, String afterUsername, UUID afterUserId, int limit) {
        var rows = afterUsername == null || afterUserId == null
                ? session.execute(findDirectory.bind(prefix, limit))
                : session.execute(findDirectoryAfter.bind(prefix, afterUsername, afterUserId, limit));
        return rows.all().stream().map(row -> new UserDirectoryEntry(
                row.getString("username_normalized"), row.getUuid("user_id"), row.getString("username"),
                row.getString("display_name"), row.getString("avatar_url"), row.getString("account_status")))
                .toList();
    }

    @Override public CanonicalUser updateProfile(UUID userId, String displayName, String avatarUrl, Instant now) {
        CanonicalUser current = findById(userId);
        if (current == null) return null;
        session.execute(updateProfile.bind(displayName, avatarUrl, now, userId));
        var batch = BatchStatement.builder(BatchType.UNLOGGED);
        for (String prefix : prefixes(current.usernameNormalized())) {
            batch.addStatement(updateDirectoryProfile.bind(
                    displayName, avatarUrl, prefix, current.usernameNormalized(), userId));
        }
        session.execute(batch.build());
        return new CanonicalUser(current.userId(), current.username(), current.usernameNormalized(), current.email(),
                current.emailNormalized(), current.passwordHash(), current.authProvider(), current.externalSubject(),
                displayName, avatarUrl, current.accountStatus(), current.createdAt(), now, current.lastLoginAt());
    }

    @Override public CanonicalUser linkExternalIdentity(
            UUID userId, String provider, String subject, Instant now) {
        CanonicalUser current = findById(userId);
        if (current == null) return null;
        session.execute(linkExternalIdentity.bind(provider, subject, now, userId));
        return new CanonicalUser(current.userId(), current.username(), current.usernameNormalized(), current.email(),
                current.emailNormalized(), current.passwordHash(), provider, subject, current.displayName(),
                current.avatarUrl(), current.accountStatus(), current.createdAt(), now, current.lastLoginAt());
    }

    @Override public CanonicalUser updateAccountStatus(UUID userId, String status, Instant now) {
        CanonicalUser current = findById(userId);
        if (current == null) return null;
        updateAccountStatusWithVersion(userId, status, now);
        var batch = BatchStatement.builder(BatchType.UNLOGGED);
        for (String prefix : prefixes(current.usernameNormalized())) {
            batch.addStatement(updateDirectoryStatus.bind(status, prefix, current.usernameNormalized(), userId));
        }
        session.execute(batch.build());
        return new CanonicalUser(current.userId(), current.username(), current.usernameNormalized(), current.email(),
                current.emailNormalized(), current.passwordHash(), current.authProvider(), current.externalSubject(),
                current.displayName(), current.avatarUrl(), status, current.createdAt(), now, current.lastLoginAt());
    }

    private void updateAccountStatusWithVersion(UUID userId, String status, Instant now) {
        for (int attempt = 0; attempt < 5; attempt++) {
            var versionRow = session.execute(findSecurityVersion.bind(userId)).one();
            if (versionRow == null) return;
            int currentVersion = versionRow.isNull("security_version") ? 1 : versionRow.getInt("security_version");
            if (session.execute(updateAccountStatus.bind(
                    status, currentVersion + 1, now, userId, currentVersion)).wasApplied()) return;
        }
        throw new IllegalStateException("Could not update account status after concurrent changes");
    }

    private List<String> prefixes(String username) {
        if (username == null || username.length() < 2) return List.of();
        int max = Math.min(20, username.length());
        List<String> values = new ArrayList<>(max - 1);
        for (int length = 2; length <= max; length++) values.add(username.substring(0, length));
        return values;
    }
}
