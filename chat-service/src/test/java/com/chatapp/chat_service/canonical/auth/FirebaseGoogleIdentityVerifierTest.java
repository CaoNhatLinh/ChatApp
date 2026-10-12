package com.chatapp.chat_service.canonical.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FirebaseGoogleIdentityVerifierTest {

    @Test
    void acceptsVerifiedGoogleIdentity() throws Exception {
        FirebaseToken token = googleToken("google.com", true);
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        when(firebaseAuth.verifyIdToken("id-token", true)).thenReturn(token);

        VerifiedGoogleIdentity identity = new FirebaseGoogleIdentityVerifier(firebaseAuth).verify("id-token");

        assertThat(identity.subject()).isEqualTo("google-uid");
        assertThat(identity.email()).isEqualTo("alice@example.com");
        assertThat(identity.authenticatedAt()).isEqualTo(Instant.ofEpochSecond(1_700_000_000L));
    }

    @Test
    void rejectsTokenIssuedThroughAnotherFirebaseProvider() throws Exception {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken passwordToken = googleToken("password", true);
        when(firebaseAuth.verifyIdToken("id-token", true)).thenReturn(passwordToken);

        assertThatThrownBy(() -> new FirebaseGoogleIdentityVerifier(firebaseAuth).verify("id-token"))
                .isInstanceOf(GoogleAuthFlowException.class)
                .extracting("code")
                .isEqualTo("GOOGLE_TOKEN_INVALID");
    }

    private FirebaseToken googleToken(String provider, boolean emailVerified) {
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid");
        when(token.getEmail()).thenReturn("alice@example.com");
        when(token.getName()).thenReturn("Alice");
        when(token.isEmailVerified()).thenReturn(emailVerified);
        when(token.getClaims()).thenReturn(Map.of(
                "auth_time", 1_700_000_000L,
                "firebase", Map.of("sign_in_provider", provider)));
        return token;
    }
}
