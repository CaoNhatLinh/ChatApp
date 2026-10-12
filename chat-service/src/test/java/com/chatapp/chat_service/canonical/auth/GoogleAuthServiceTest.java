package com.chatapp.chat_service.canonical.auth;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.notification.NotificationRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

@ExtendWith(MockitoExtension.class)
class GoogleAuthServiceTest {

    @Mock private GoogleIdentityVerifier verifier;
    @Mock private ExternalIdentityRepository identities;
    @Mock private UserRepository users;
    @Mock private JwtTokenProvider tokens;
    @Mock private NotificationRepository notifications;
    @Mock private PasswordEncoder passwordEncoder;

    @Test
    void exchangeReturnsCanonicalSessionForLinkedIdentity() {
        UUID userId = UUID.randomUUID();
        CanonicalUser user = activeUser(userId, "LOCAL", null);
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.findUserId("google-uid")).thenReturn(userId);
        when(users.findById(userId)).thenReturn(user);
        when(tokens.generateToken("alice", userId)).thenReturn("noi-token");

        GoogleAuthContracts.GoogleExchangeResponse response = service().exchange("firebase-token");

        assertThat(response.status()).isEqualTo("SIGNED_IN");
        assertThat(response.session().accessToken()).isEqualTo("noi-token");
    }

    @Test
    void exchangeRequestsRegistrationForNewVerifiedIdentity() {
        when(verifier.verify("firebase-token")).thenReturn(identity());

        GoogleAuthContracts.GoogleExchangeResponse response = service().exchange("firebase-token");

        assertThat(response.status()).isEqualTo("REGISTRATION_REQUIRED");
        assertThat(response.suggestedDisplayName()).isEqualTo("Alice");
    }

    @Test
    void exchangeReturnsOnboardingWhenAPreviousRegistrationStoppedBeforeUserSave() {
        UUID reservedUserId = UUID.randomUUID();
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.findUserId("google-uid")).thenReturn(reservedUserId);
        when(users.findById(reservedUserId)).thenReturn(null);

        GoogleAuthContracts.GoogleExchangeResponse response = service().exchange("firebase-token");

        assertThat(response.status()).isEqualTo("REGISTRATION_REQUIRED");
        assertThat(response.suggestedDisplayName()).isEqualTo("Alice");
    }

    @Test
    void exchangeRequiresExplicitLinkWhenCanonicalEmailAlreadyExists() {
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(users.findByEmail("alice@example.com")).thenReturn(activeUser(UUID.randomUUID(), "LOCAL", null));

        assertThatThrownBy(() -> service().exchange("firebase-token"))
                .isInstanceOf(GoogleAuthFlowException.class)
                .extracting("code")
                .isEqualTo("ACCOUNT_LINK_REQUIRED");
    }

    @Test
    void registerCreatesExternalOnlyCanonicalAccount() {
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.claim(eq("google-uid"), any(), any())).thenReturn(true);
        when(users.claimUsername(any(), any(), any())).thenReturn(true);
        when(users.claimEmail(any(), any(), any())).thenReturn(true);
        when(tokens.generateToken(any(), any())).thenReturn("noi-token");

        GoogleAuthContracts.GoogleExchangeResponse response = service().register(
                "firebase-token", "alice", "Alice Nguyen");

        assertThat(response.status()).isEqualTo("SIGNED_IN");
        ArgumentCaptor<CanonicalUser> saved = ArgumentCaptor.forClass(CanonicalUser.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().passwordHash()).isNull();
        assertThat(saved.getValue().authProvider()).isEqualTo("FIREBASE_GOOGLE");
        assertThat(saved.getValue().externalSubject()).isEqualTo("google-uid");
    }

    @Test
    void registerResumesAnExistingIdentityReservationWithTheSameUserId() {
        UUID reservedUserId = UUID.randomUUID();
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.findUserId("google-uid")).thenReturn(reservedUserId);
        when(users.findById(reservedUserId)).thenReturn(null);
        when(users.claimUsername(eq("alice"), eq(reservedUserId), any())).thenReturn(true);
        when(users.claimEmail(eq("alice@example.com"), eq(reservedUserId), any())).thenReturn(true);
        when(tokens.generateToken("alice", reservedUserId)).thenReturn("noi-token");

        GoogleAuthContracts.GoogleExchangeResponse response = service().register(
                "firebase-token", "alice", "Alice Nguyen");

        assertThat(response.status()).isEqualTo("SIGNED_IN");
        ArgumentCaptor<CanonicalUser> saved = ArgumentCaptor.forClass(CanonicalUser.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().userId()).isEqualTo(reservedUserId);
        verify(identities, never()).claim(any(), any(), any());
    }

    @Test
    void registerReleasesIdentityReservationWhenUsernameIsUnavailable() {
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.claim(eq("google-uid"), any(), any())).thenReturn(true);

        assertThatThrownBy(() -> service().register("firebase-token", "alice", "Alice"))
                .isInstanceOf(GoogleAuthFlowException.class)
                .extracting("code")
                .isEqualTo("USERNAME_UNAVAILABLE");

        verify(identities).release(eq("google-uid"), any());
        verify(users, never()).save(any());
    }

    @Test
    void linkRequiresPasswordAndFreshGoogleIdentityForTheSameEmail() {
        UUID userId = UUID.randomUUID();
        CanonicalUser user = activeUser(userId, "LOCAL", null);
        when(users.findById(userId)).thenReturn(user);
        when(passwordEncoder.matches("password123", "encoded")).thenReturn(true);
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.claim(eq("google-uid"), eq(userId), any())).thenReturn(true);
        when(users.linkExternalIdentity(eq(userId), eq("FIREBASE_GOOGLE"), eq("google-uid"), any()))
                .thenReturn(activeUser(userId, "FIREBASE_GOOGLE", "google-uid"));

        GoogleAuthContracts.ConnectedIdentities response = service().link(
                userId, "firebase-token", "password123");

        assertThat(response.google().linked()).isTrue();
        verify(users).linkExternalIdentity(eq(userId), eq("FIREBASE_GOOGLE"), eq("google-uid"), any());
    }

    private GoogleAuthService service() {
        return new GoogleAuthService(verifier, identities, users, tokens, notifications, passwordEncoder);
    }

    @Test
    void ambiguousUserSaveNeverReleasesUniqueReservations() {
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.claim(eq("google-uid"), any(), any())).thenReturn(true);
        when(users.claimUsername(any(), any(), any())).thenReturn(true);
        when(users.claimEmail(any(), any(), any())).thenReturn(true);
        doThrow(new IllegalStateException("write outcome unknown")).when(users).save(any());

        assertThatThrownBy(() -> service().register("firebase-token", "alice", "Alice"))
                .isInstanceOf(IllegalStateException.class);

        verify(users, never()).releaseUsername(any(), any());
        verify(users, never()).releaseEmail(any(), any());
        verify(identities, never()).release(any(), any());
        verify(tokens, never()).generateToken(any(), any());
    }

    @Test
    void suspendedRegistrationRetryDoesNotChangeSettingsOrIssueToken() {
        UUID userId = UUID.randomUUID();
        Instant now = Instant.now();
        CanonicalUser suspended = new CanonicalUser(userId, "alice", "alice", "alice@example.com",
                "alice@example.com", null, "FIREBASE_GOOGLE", "google-uid", "Alice", null,
                "SUSPENDED", now, now, now);
        when(verifier.verify("firebase-token")).thenReturn(identity());
        when(identities.findUserId("google-uid")).thenReturn(userId);
        when(users.findById(userId)).thenReturn(suspended);

        assertThatThrownBy(() -> service().register("firebase-token", "alice", "Alice"))
                .isInstanceOf(GoogleAuthFlowException.class).extracting("code").isEqualTo("ACCOUNT_UNAVAILABLE");
        verify(notifications, never()).saveSettings(any());
        verify(tokens, never()).generateToken(any(), any());
    }

    private VerifiedGoogleIdentity identity() {
        return new VerifiedGoogleIdentity(
                "google-uid", "alice@example.com", "Alice", Instant.now().minusSeconds(30));
    }

    private CanonicalUser activeUser(UUID userId, String provider, String subject) {
        Instant now = Instant.now();
        return new CanonicalUser(userId, "alice", "alice", "alice@example.com", "alice@example.com",
                "encoded", provider, subject, "Alice", null, "ACTIVE", now, now, now);
    }
}
