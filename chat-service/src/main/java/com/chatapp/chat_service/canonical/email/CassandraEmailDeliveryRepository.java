package com.chatapp.chat_service.canonical.email;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Repository
public class CassandraEmailDeliveryRepository implements EmailDeliveryRepository {
    // Email is user-level, not device-level. Reserve a non-device slot in the existing delivery ledger.
    static final UUID EMAIL_DEVICE = new UUID(0, 0);
    private final CqlSession session;
    private final PreparedStatement enqueue, pending, remove, find, initialize, replace, suppressed, suppress;
    private final PreparedStatement conversation, member;
    private final PreparedStatement pendingAfter;

    public CassandraEmailDeliveryRepository(CqlSession session) {
        this.session = session;
        conversation = session.prepare("SELECT conversation_type, is_deleted FROM conversations_by_id WHERE conversation_id = ?");
        member = session.prepare("SELECT user_id FROM conversation_members_by_conversation WHERE conversation_id = ? AND user_id = ?");
        enqueue = session.prepare("INSERT INTO email_jobs_by_shard (shard, notification_id, user_id, notification_month, created_at) VALUES (?, ?, ?, ?, ?)");
        pending = session.prepare("SELECT * FROM email_jobs_by_shard WHERE shard = ? LIMIT ?");
        pendingAfter = session.prepare("SELECT * FROM email_jobs_by_shard WHERE shard = ? AND (notification_id, user_id) > (?, ?) LIMIT ?");
        remove = session.prepare("DELETE FROM email_jobs_by_shard WHERE shard = ? AND notification_id = ? AND user_id = ?");
        find = session.prepare("SELECT * FROM notification_deliveries_by_notification WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ?");
        initialize = session.prepare("""
                INSERT INTO notification_deliveries_by_notification
                (user_id, notification_month, notification_id, device_id, channel, delivery_status,
                 request_json, attempt_count, revision, failure_code)
                VALUES (?, ?, ?, ?, 'EMAIL', ?, ?, 0, ?, ?) IF NOT EXISTS
                """);
        replace = session.prepare("""
                UPDATE notification_deliveries_by_notification SET delivery_status = ?, provider_message_id = ?,
                attempted_at = ?, lease_until = ?, retry_at = ?, attempt_count = ?, revision = ?, delivered_at = ?, failure_code = ?
                WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ? IF revision = ?
                """);
        suppressed = session.prepare("SELECT address_hash FROM email_suppressions_by_address WHERE address_hash = ?");
        suppress = session.prepare("INSERT INTO email_suppressions_by_address (address_hash, reason, created_at) VALUES (?, ?, ?)");
    }

    public BoundStatement pointer(UUID userId, String month, UUID id, Instant createdAt) {
        return enqueue.bind(shard(userId), id, userId, month, createdAt);
    }

    @Override public List<Job> pending(int shard, Key after, int limit) {
        int bounded = Math.max(1, Math.min(100, limit));
        var query = after == null ? pending.bind(shard, bounded)
                : pendingAfter.bind(shard, after.notificationId(), after.userId(), bounded);
        return session.execute(query).all().stream()
                .map(row -> new Job(new Key(row.getUuid("user_id"), row.getString("notification_month"),
                        row.getUuid("notification_id")), row.getInstant("created_at"))).toList();
    }
    @Override public void remove(Job job) {
        session.execute(remove.bind(shard(job.key().userId()), job.key().notificationId(), job.key().userId()));
    }
    @Override public Delivery find(Key key) {
        Row row = session.execute(find.bind(key.userId(), key.month(), key.notificationId(), EMAIL_DEVICE)).one();
        return row == null ? null : new Delivery(key, row.getString("delivery_status"), row.getString("provider_message_id"),
                row.getString("request_json"), row.getInstant("attempted_at"), row.getInstant("lease_until"),
                row.getInstant("retry_at"), row.getInt("attempt_count"), row.getUuid("revision"),
                row.getInstant("delivered_at"), row.getString("failure_code"), row.getInstant("reviewed_at"));
    }
    @Override public Delivery initialize(Delivery delivery) {
        Key key = delivery.key();
        boolean applied = session.execute(initialize.bind(key.userId(), key.month(), key.notificationId(),
                EMAIL_DEVICE, delivery.status(), delivery.requestJson(), delivery.revision(), delivery.failureCode())).wasApplied();
        return applied ? delivery : find(key);
    }
    @Override public boolean replace(Delivery previous, Delivery next) {
        Key key = previous.key();
        return session.execute(replace.bind(next.status(), next.providerId(), next.attemptedAt(), next.leaseUntil(),
                next.retryAt(), next.attempts(), next.revision(), next.deliveredAt(), next.failureCode(),
                key.userId(), key.month(), key.notificationId(), EMAIL_DEVICE, previous.revision())).wasApplied();
    }
    @Override public boolean suppressed(String email) {
        return session.execute(suppressed.bind(addressHash(email))).one() != null;
    }
    @Override public void suppress(String email, String reason) {
        session.execute(suppress.bind(addressHash(email), reason, Instant.now()));
    }
    @Override public boolean conversationEligible(UUID userId, UUID conversationId, boolean directOnly) {
        if (conversationId == null) return !directOnly;
        Row room = session.execute(conversation.bind(conversationId)).one();
        return room != null && !room.getBoolean("is_deleted")
                && (!directOnly || "DM".equals(room.getString("conversation_type")))
                && session.execute(member.bind(conversationId, userId)).one() != null;
    }
    static int shard(UUID userId) { return Math.floorMod(userId.hashCode(), 16); }
    static String addressHash(String email) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(ResendSettings.normalizeEmail(email).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
