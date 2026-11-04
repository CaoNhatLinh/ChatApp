package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.Key;

import java.time.Instant;
import java.util.UUID;

public interface EmailReviewDispositionRepository {
    record Receipt(UUID commandId, UUID actorId, String reason, Instant reviewedAt) { }
    record State(String status, Receipt receipt) { }

    State find(Key key);
    boolean close(Key key, Receipt receipt);
}
