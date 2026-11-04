package com.chatapp.chat_service.canonical.email;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Repository
public class CassandraEmailReviewRepository implements EmailReviewRepository {
    private static final int MAX_CANDIDATES = 51;
    private static final int HYDRATION_CONCURRENCY = 8;

    private final CqlSession session;
    private final PreparedStatement register;
    private final PreparedStatement first;
    private final PreparedStatement next;
    private final PreparedStatement find;

    public CassandraEmailReviewRepository(CqlSession session) {
        this.session = session;
        register = session.prepare("""
                INSERT INTO email_review_candidates_by_day
                    (review_day, notification_id, user_id, notification_month)
                VALUES (?, ?, ?, ?)
                """);
        first = session.prepare("""
                SELECT notification_id, user_id, notification_month FROM email_review_candidates_by_day
                WHERE review_day = ? LIMIT ?
                """);
        next = session.prepare("""
                SELECT notification_id, user_id, notification_month FROM email_review_candidates_by_day
                WHERE review_day = ? AND (notification_id, user_id, notification_month) < (?, ?, ?) LIMIT ?
                """);
        find = session.prepare("""
                SELECT channel, delivery_status, attempt_count, attempted_at, review_command_id
                FROM notification_deliveries_by_notification
                WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ?
                """);
    }

    @Override
    public void register(Candidate candidate) {
        var key = candidate.key();
        session.execute(register.bind(candidate.day().toString(), key.notificationId(), key.userId(), key.month())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setIdempotent(true));
    }

    @Override
    public List<Candidate> list(LocalDate day, Candidate after, int limit) {
        if (after != null && !day.equals(after.day())) throw new IllegalArgumentException("Cursor day does not match");
        int bounded = Math.max(1, Math.min(MAX_CANDIDATES, limit));
        var query = after == null ? first.bind(day.toString(), bounded)
                : next.bind(day.toString(), after.key().notificationId(), after.key().userId(), after.key().month(), bounded);
        return session.execute(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(row -> new Candidate(day, new EmailDeliveryRepository.Key(
                        row.getUuid("user_id"), row.getString("notification_month"), row.getUuid("notification_id"))))
                .toList();
    }

    @Override
    public Map<EmailDeliveryRepository.Key, Review> findAll(List<EmailDeliveryRepository.Key> keys) {
        if (keys.size() > MAX_CANDIDATES) throw new IllegalArgumentException("Email review page exceeds hydration limit");
        Map<EmailDeliveryRepository.Key, Review> reviews = new HashMap<>();
        for (int offset = 0; offset < keys.size(); offset += HYDRATION_CONCURRENCY) {
            var group = keys.subList(offset, Math.min(keys.size(), offset + HYDRATION_CONCURRENCY));
            var reads = group.stream().map(this::readReview).toList();
            for (int i = 0; i < group.size(); i++) {
                var review = reads.get(i).join();
                if (review != null) reviews.put(group.get(i), review);
            }
        }
        return Map.copyOf(reviews);
    }

    private CompletableFuture<Review> readReview(EmailDeliveryRepository.Key key) {
        var query = find.bind(key.userId(), key.month(), key.notificationId(), CassandraEmailDeliveryRepository.EMAIL_DEVICE)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        return session.executeAsync(query).thenApply(result -> {
            var row = result.one();
            if (row == null || !"EMAIL".equals(row.getString("channel"))
                    || !"REVIEW_REQUIRED".equals(row.getString("delivery_status"))
                    || !row.isNull("review_command_id")) return null;
            return new Review(row.getInt("attempt_count"), row.getInstant("attempted_at"));
        }).toCompletableFuture();
    }
}
