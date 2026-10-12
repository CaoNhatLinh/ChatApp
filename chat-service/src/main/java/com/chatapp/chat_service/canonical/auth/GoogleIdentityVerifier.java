package com.chatapp.chat_service.canonical.auth;

public interface GoogleIdentityVerifier {
    boolean isAvailable();

    VerifiedGoogleIdentity verify(String idToken);
}
