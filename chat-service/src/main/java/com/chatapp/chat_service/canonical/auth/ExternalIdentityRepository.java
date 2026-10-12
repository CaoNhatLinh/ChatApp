package com.chatapp.chat_service.canonical.auth;

import java.time.Instant;
import java.util.UUID;

public interface ExternalIdentityRepository {
    UUID findUserId(String subject);

    boolean claim(String subject, UUID userId, Instant createdAt);

    boolean release(String subject, UUID userId);
}
