package com.chatapp.chat_service.canonical.auth;

import java.time.Instant;

/** Identity attributes accepted only after Firebase Admin verification. */
public record VerifiedGoogleIdentity(
        String subject,
        String email,
        String displayName,
        Instant authenticatedAt) {
}
