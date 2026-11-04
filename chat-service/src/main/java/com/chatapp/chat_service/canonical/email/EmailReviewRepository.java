package com.chatapp.chat_service.canonical.email;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface EmailReviewRepository {
    record Candidate(LocalDate day, EmailDeliveryRepository.Key key) { }
    record Review(int attempts, Instant attemptedAt) { }

    void register(Candidate candidate);
    List<Candidate> list(LocalDate day, Candidate after, int limit);
    Map<EmailDeliveryRepository.Key, Review> findAll(List<EmailDeliveryRepository.Key> keys);
}
