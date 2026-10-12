package com.chatapp.chat_service.canonical.auth;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.notification.NotificationRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class GoogleAuthService {
    private static final String PROVIDER = "FIREBASE_GOOGLE";

    private final GoogleIdentityVerifier verifier;
    private final ExternalIdentityRepository identities;
    private final UserRepository users;
    private final JwtTokenProvider tokens;
    private final NotificationRepository notifications;
    private final PasswordEncoder passwordEncoder;

    public GoogleAuthService(
            GoogleIdentityVerifier verifier,
            ExternalIdentityRepository identities,
            UserRepository users,
            JwtTokenProvider tokens,
            NotificationRepository notifications,
            PasswordEncoder passwordEncoder) {
        this.verifier = verifier;
        this.identities = identities;
        this.users = users;
        this.tokens = tokens;
        this.notifications = notifications;
        this.passwordEncoder = passwordEncoder;
    }

    public GoogleAuthContracts.ProviderCapabilities capabilities() {
        return new GoogleAuthContracts.ProviderCapabilities(
                new GoogleAuthContracts.GoogleProvider(verifier.isAvailable()));
    }

    public GoogleAuthContracts.GoogleExchangeResponse exchange(String idToken) {
        VerifiedGoogleIdentity identity = verifier.verify(idToken);
        UUID userId = identities.findUserId(identity.subject());
        if (userId != null) {
            CanonicalUser user = users.findById(userId);
            if (user != null) {
                return GoogleAuthContracts.GoogleExchangeResponse.signedIn(createSession(requireActive(user)));
            }
            return GoogleAuthContracts.GoogleExchangeResponse.registrationRequired(identity.displayName());
        }
        if (users.findByEmail(normalize(identity.email())) != null) {
            throw flow(HttpStatus.CONFLICT, "ACCOUNT_LINK_REQUIRED",
                    "A canonical account already uses this email");
        }
        return GoogleAuthContracts.GoogleExchangeResponse.registrationRequired(identity.displayName());
    }

    public GoogleAuthContracts.GoogleExchangeResponse register(
            String idToken, String username, String displayName) {
        VerifiedGoogleIdentity identity = verifier.verify(idToken);
        UUID linkedUserId = identities.findUserId(identity.subject());
        if (linkedUserId != null) {
            CanonicalUser linkedUser = users.findById(linkedUserId);
            if (linkedUser != null) {
                requireActive(linkedUser);
                ensureDefaultNotificationSettings(linkedUserId, Instant.now());
                return GoogleAuthContracts.GoogleExchangeResponse.signedIn(createSession(linkedUser));
            }
            CanonicalUser resumed = createGoogleUser(
                    identity, username, displayName, linkedUserId, false);
            return GoogleAuthContracts.GoogleExchangeResponse.signedIn(createSession(resumed));
        }
        ensureEmailIsAvailable(identity.email());
        CanonicalUser user = createGoogleUser(identity, username, displayName, UUID.randomUUID(), true);
        return GoogleAuthContracts.GoogleExchangeResponse.signedIn(createSession(user));
    }

    public GoogleAuthContracts.ConnectedIdentities connectedIdentities(UUID userId) {
        CanonicalUser user = findActiveUser(userId);
        boolean linked = PROVIDER.equals(user.authProvider()) && StringUtils.hasText(user.externalSubject());
        return connectedIdentities(linked, linked ? user.email() : null);
    }

    public GoogleAuthContracts.ConnectedIdentities link(
            UUID userId, String idToken, String currentPassword) {
        CanonicalUser user = findActiveUser(userId);
        requireLocalPassword(user, currentPassword);
        VerifiedGoogleIdentity identity = verifier.verify(idToken);
        requireFreshMatchingIdentity(user, identity);
        claimIdentityForUser(identity.subject(), userId);
        CanonicalUser linked = users.linkExternalIdentity(userId, PROVIDER, identity.subject(), Instant.now());
        if (linked == null) {
            throw flow(HttpStatus.SERVICE_UNAVAILABLE, "ACCOUNT_SETUP_PENDING",
                    "The canonical account could not be linked");
        }
        return connectedIdentities(true, identity.email());
    }

    private void requireLocalPassword(CanonicalUser user, String currentPassword) {
        if (user.passwordHash() == null || !passwordEncoder.matches(currentPassword, user.passwordHash())) {
            throw flow(HttpStatus.UNAUTHORIZED, "REAUTHENTICATION_REQUIRED",
                    "Current password verification failed");
        }
    }

    private void requireFreshMatchingIdentity(CanonicalUser user, VerifiedGoogleIdentity identity) {
        if (!normalize(user.email()).equals(normalize(identity.email()))) {
            throw flow(HttpStatus.CONFLICT, "GOOGLE_EMAIL_MISMATCH",
                    "Google email must match the canonical account email");
        }
        Instant now = Instant.now();
        if (identity.authenticatedAt().isBefore(now.minusSeconds(300))
                || identity.authenticatedAt().isAfter(now.plusSeconds(30))) {
            throw flow(HttpStatus.UNAUTHORIZED, "REAUTHENTICATION_REQUIRED",
                    "A recent Google sign-in is required");
        }
    }

    private void claimIdentityForUser(String subject, UUID userId) {
        UUID owner = identities.findUserId(subject);
        if (owner == null && identities.claim(subject, userId, Instant.now())) return;
        owner = identities.findUserId(subject);
        if (!userId.equals(owner)) {
            throw flow(HttpStatus.CONFLICT, "IDENTITY_ALREADY_LINKED",
                    "This Google account is linked to another canonical account");
        }
    }

    private GoogleAuthContracts.ConnectedIdentities connectedIdentities(boolean linked, String email) {
        return new GoogleAuthContracts.ConnectedIdentities(
                new GoogleAuthContracts.GoogleIdentityStatus(linked, email));
    }

    private CanonicalUser createGoogleUser(
            VerifiedGoogleIdentity identity,
            String username,
            String displayName,
            UUID userId,
            boolean claimExternalIdentity) {
        Instant now = Instant.now();
        boolean identityClaimedHere = false;
        if (claimExternalIdentity) {
            if (identities.claim(identity.subject(), userId, now)) {
                identityClaimedHere = true;
            } else {
                UUID owner = identities.findUserId(identity.subject());
                if (owner == null) {
                    throw flow(HttpStatus.SERVICE_UNAVAILABLE, "ACCOUNT_SETUP_PENDING",
                            "Account setup is pending; retry shortly");
                }
                CanonicalUser claimed = users.findById(owner);
                if (claimed != null) return requireActive(claimed);
                userId = owner;
            }
        }

        String normalizedUsername = normalize(username);
        String normalizedEmail = normalize(identity.email());
        boolean usernameClaimed = false;
        boolean emailClaimed = false;
        boolean userSaveAttempted = false;
        try {
            usernameClaimed = claimUsername(normalizedUsername, userId, now);
            emailClaimed = claimEmail(normalizedEmail, userId, now);
            CanonicalUser user = googleUser(
                    userId, username.trim(), normalizedUsername, identity, displayName.trim(), now);
            // A timeout (or directory failure) does not prove the primary user write failed.
            // Preserve unique reservations once that write starts so a retry keeps the same owner.
            userSaveAttempted = true;
            users.save(user);
            ensureDefaultNotificationSettings(userId, now);
            return user;
        } catch (RuntimeException failure) {
            if (!userSaveAttempted) {
                releaseReservations(identity.subject(), userId, normalizedUsername, normalizedEmail,
                        identityClaimedHere, usernameClaimed, emailClaimed);
            }
            throw failure;
        }
    }

    private boolean claimUsername(String username, UUID userId, Instant now) {
        if (!users.claimUsername(username, userId, now)) {
            throw flow(HttpStatus.CONFLICT, "USERNAME_UNAVAILABLE", "Username is unavailable");
        }
        return true;
    }

    private boolean claimEmail(String email, UUID userId, Instant now) {
        if (!users.claimEmail(email, userId, now)) {
            throw flow(HttpStatus.CONFLICT, "ACCOUNT_LINK_REQUIRED",
                    "A canonical account already uses this email");
        }
        return true;
    }

    private void releaseReservations(
            String subject,
            UUID userId,
            String username,
            String email,
            boolean identityClaimedHere,
            boolean usernameClaimed,
            boolean emailClaimed) {
        if (emailClaimed) users.releaseEmail(email, userId);
        if (usernameClaimed) users.releaseUsername(username, userId);
        if (identityClaimedHere) identities.release(subject, userId);
    }

    private void ensureEmailIsAvailable(String email) {
        if (users.findByEmail(normalize(email)) != null) {
            throw flow(HttpStatus.CONFLICT, "ACCOUNT_LINK_REQUIRED",
                    "A canonical account already uses this email");
        }
    }

    private CanonicalUser findActiveUser(UUID userId) {
        CanonicalUser user = users.findById(userId);
        if (user == null) {
            throw flow(HttpStatus.SERVICE_UNAVAILABLE, "ACCOUNT_SETUP_PENDING",
                    "The linked canonical account is not ready");
        }
        return requireActive(user);
    }

    private CanonicalUser requireActive(CanonicalUser user) {
        if (!"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw flow(HttpStatus.FORBIDDEN, "ACCOUNT_UNAVAILABLE", "User account is unavailable");
        }
        return user;
    }

    private CanonicalApiContracts.AuthResponse createSession(CanonicalUser user) {
        String accessToken = tokens.generateToken(user.username(), user.userId());
        return new CanonicalApiContracts.AuthResponse(accessToken, UserResponseMapper.toUserResponse(user));
    }

    private CanonicalUser googleUser(
            UUID userId,
            String username,
            String normalizedUsername,
            VerifiedGoogleIdentity identity,
            String displayName,
            Instant now) {
        return new CanonicalUser(
                userId, username, normalizedUsername, identity.email(), normalize(identity.email()),
                null, PROVIDER, identity.subject(), displayName, null, "ACTIVE", now, now, now);
    }

    private void ensureDefaultNotificationSettings(UUID userId, Instant now) {
        if (notifications.findSettings(userId) == null) {
            notifications.saveSettings(new CanonicalNotificationSettings(
                    userId, "ALL", true, true, true, true, null, null, "UTC", now));
        }
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
    }

    private GoogleAuthFlowException flow(HttpStatus status, String code, String message) {
        return new GoogleAuthFlowException(status, code, message);
    }
}
