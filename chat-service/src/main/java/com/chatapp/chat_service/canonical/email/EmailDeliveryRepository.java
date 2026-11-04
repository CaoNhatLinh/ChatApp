package com.chatapp.chat_service.canonical.email;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface EmailDeliveryRepository {
    record Key(UUID userId, String month, UUID notificationId) { }
    record Job(Key key, Instant createdAt) { }
    record Delivery(Key key, String status, String providerId, String requestJson, Instant attemptedAt,
                    Instant leaseUntil, Instant retryAt, int attempts, UUID revision,
                    Instant deliveredAt, String failureCode, Instant reviewedAt) {
        Delivery(Key key, String status, String providerId, String requestJson, Instant attemptedAt,
                 Instant leaseUntil, Instant retryAt, int attempts, UUID revision,
                 Instant deliveredAt, String failureCode) {
            this(key, status, providerId, requestJson, attemptedAt, leaseUntil, retryAt, attempts,
                    revision, deliveredAt, failureCode, null);
        }

        Delivery change(String status, String providerId, Instant attemptedAt, Instant leaseUntil,
                        Instant retryAt, int attempts, Instant deliveredAt, String failureCode) {
            return new Delivery(key, status, providerId, requestJson, attemptedAt, leaseUntil,
                    retryAt, attempts, UUID.randomUUID(), deliveredAt, failureCode, reviewedAt);
        }
        boolean finished() { return !List.of("PENDING", "SENDING", "RETRY").contains(status); }
    }

    List<Job> pending(int shard, Key after, int limit);
    void remove(Job job);
    Delivery find(Key key);
    Delivery initialize(Delivery delivery);
    boolean replace(Delivery previous, Delivery next);
    boolean suppressed(String email);
    void suppress(String email, String reason);
    boolean conversationEligible(UUID userId, UUID conversationId, boolean directOnly);
}
