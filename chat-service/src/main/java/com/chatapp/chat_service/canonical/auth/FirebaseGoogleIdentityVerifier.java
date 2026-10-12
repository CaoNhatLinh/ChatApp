package com.chatapp.chat_service.canonical.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.auth.google.enabled", havingValue = "true")
public class FirebaseGoogleIdentityVerifier implements GoogleIdentityVerifier {
    private static final String GOOGLE_PROVIDER = "google.com";

    private final FirebaseAuth firebaseAuth;

    public FirebaseGoogleIdentityVerifier(FirebaseAuth firebaseAuth) {
        this.firebaseAuth = firebaseAuth;
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public VerifiedGoogleIdentity verify(String idToken) {
        try {
            return verifiedIdentity(firebaseAuth.verifyIdToken(idToken, true));
        } catch (FirebaseAuthException exception) {
            throw invalidToken();
        }
    }

    private VerifiedGoogleIdentity verifiedIdentity(FirebaseToken token) {
        if (!token.isEmailVerified() || token.getEmail() == null || token.getEmail().isBlank()) {
            throw invalidToken();
        }
        if (!GOOGLE_PROVIDER.equals(signInProvider(token.getClaims()))) {
            throw invalidToken();
        }
        return new VerifiedGoogleIdentity(
                token.getUid(), token.getEmail(), safeDisplayName(token), authenticatedAt(token.getClaims()));
    }

    private String signInProvider(Map<String, Object> claims) {
        Object firebase = claims.get("firebase");
        if (!(firebase instanceof Map<?, ?> firebaseClaims)) return "";
        Object provider = firebaseClaims.get("sign_in_provider");
        return provider instanceof String value ? value : "";
    }

    private Instant authenticatedAt(Map<String, Object> claims) {
        Object authTime = claims.get("auth_time");
        if (!(authTime instanceof Number timestamp)) throw invalidToken();
        return Instant.ofEpochSecond(timestamp.longValue());
    }

    private String safeDisplayName(FirebaseToken token) {
        return token.getName() == null ? "" : token.getName().trim();
    }

    private GoogleAuthFlowException invalidToken() {
        return new GoogleAuthFlowException(
                HttpStatus.UNAUTHORIZED,
                "GOOGLE_TOKEN_INVALID",
                "Google identity could not be verified");
    }
}
