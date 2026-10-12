package com.chatapp.chat_service.canonical.auth;

import org.springframework.http.HttpStatus;

final class DisabledGoogleIdentityVerifier implements GoogleIdentityVerifier {
    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public VerifiedGoogleIdentity verify(String idToken) {
        throw new GoogleAuthFlowException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "GOOGLE_AUTH_UNAVAILABLE",
                "Google sign-in is not configured");
    }
}
