package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.Key;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;

@Repository
public class CassandraEmailReviewDispositionRepository implements EmailReviewDispositionRepository {
    private final CqlSession session;
    private final PreparedStatement find;
    private final PreparedStatement close;

    public CassandraEmailReviewDispositionRepository(CqlSession session) {
        this.session = session;
        find = session.prepare("""
                SELECT channel, delivery_status, review_command_id, reviewed_by, review_reason, reviewed_at
                FROM notification_deliveries_by_notification
                WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ?
                """);
        close = session.prepare("""
                UPDATE notification_deliveries_by_notification
                SET review_command_id = ?, reviewed_by = ?, review_reason = ?, reviewed_at = ?
                WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ?
                IF channel = 'EMAIL' AND delivery_status = 'REVIEW_REQUIRED' AND review_command_id = null
                """);
    }

    @Override
    public State find(Key key) {
        var row = session.execute(find.bind(key.userId(), key.month(), key.notificationId(),
                        CassandraEmailDeliveryRepository.EMAIL_DEVICE)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
        if (row == null || !"EMAIL".equals(row.getString("channel"))) return null;

        var commandId = row.getUuid("review_command_id");
        var receipt = commandId == null ? null : new Receipt(commandId, row.getUuid("reviewed_by"),
                row.getString("review_reason"), row.getInstant("reviewed_at"));
        return new State(row.getString("delivery_status"), receipt);
    }

    @Override
    public boolean close(Key key, Receipt receipt) {
        return session.execute(close.bind(receipt.commandId(), receipt.actorId(), receipt.reason(), receipt.reviewedAt(),
                        key.userId(), key.month(), key.notificationId(), CassandraEmailDeliveryRepository.EMAIL_DEVICE)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL)
                .setIdempotent(false)).wasApplied();
    }
}
