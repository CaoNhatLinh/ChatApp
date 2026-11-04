package com.chatapp.chat_service.canonical.email;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Repository
public class CassandraEmailHistoryReader {
    private static final int MAX_PAGE_SIZE = 50;
    private static final int HYDRATION_CONCURRENCY = 8;

    private final CqlSession session;
    private final PreparedStatement notificationIds;
    private final PreparedStatement notificationIdsBefore;
    private final PreparedStatement delivery;

    public CassandraEmailHistoryReader(CqlSession session) {
        this.session = session;
        notificationIds = session.prepare("""
                SELECT notification_id FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ? LIMIT ?
                """);
        notificationIdsBefore = session.prepare("""
                SELECT notification_id FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ? AND notification_id < ? LIMIT ?
                """);
        delivery = session.prepare("""
                SELECT channel, delivery_status, attempted_at, delivered_at
                FROM notification_deliveries_by_notification
                WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ?
                """);
    }

    public List<UUID> notificationIds(UUID userId, String month, UUID after, int limit) {
        int bounded = Math.max(1, Math.min(MAX_PAGE_SIZE + 1, limit));
        var query = after == null ? notificationIds.bind(userId, month, bounded)
                : notificationIdsBefore.bind(userId, month, after, bounded);
        return session.execute(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(row -> row.getUuid("notification_id"))
                .toList();
    }

    public List<DeliveryItem> deliveries(UUID userId, String month, List<UUID> ids) {
        if (ids.size() > MAX_PAGE_SIZE) throw new IllegalArgumentException("email history page exceeds hydration limit");
        List<DeliveryItem> found = new ArrayList<>(ids.size());
        for (int offset = 0; offset < ids.size(); offset += HYDRATION_CONCURRENCY) {
            int end = Math.min(ids.size(), offset + HYDRATION_CONCURRENCY);
            var reads = ids.subList(offset, end).stream().map(id -> readDelivery(userId, month, id)).toList();
            for (var read : reads) {
                DeliveryItem item = read.join();
                if (item != null) found.add(item);
            }
        }
        return List.copyOf(found);
    }

    private CompletableFuture<DeliveryItem> readDelivery(UUID userId, String month, UUID id) {
        var query = delivery.bind(userId, month, id, CassandraEmailDeliveryRepository.EMAIL_DEVICE)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        return session.executeAsync(query).thenApply(result -> {
            var row = result.one();
            if (row == null || !"EMAIL".equals(row.getString("channel"))) return null;
            return new DeliveryItem(id, row.getString("delivery_status"),
                    row.getInstant("attempted_at"), row.getInstant("delivered_at"));
        }).toCompletableFuture();
    }

    public record DeliveryItem(UUID notificationId, String status, Instant attemptedAt, Instant deliveredAt) {}
}
