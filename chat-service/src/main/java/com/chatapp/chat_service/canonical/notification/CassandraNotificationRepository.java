package com.chatapp.chat_service.canonical.notification;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class CassandraNotificationRepository implements NotificationRepository {
    private final CqlSession session;
    private final PreparedStatement findSettings;
    private final PreparedStatement saveSettings;
    private final PreparedStatement findByMonth;
    private final PreparedStatement save;
    private final PreparedStatement markRead;
    private final PreparedStatement delete;
    private final PreparedStatement deleteMonth;

    public CassandraNotificationRepository(CqlSession session) {
        this.session = session;
        this.findSettings = session.prepare(
                "SELECT * FROM user_notification_preferences WHERE user_id = ?");
        this.saveSettings = session.prepare("""
                INSERT INTO user_notification_preferences
                    (user_id, global_level, push_enabled, email_enabled, desktop_enabled, sound_enabled,
                     quiet_hours_start, quiet_hours_end, timezone, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.findByMonth = session.prepare("""
                SELECT * FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ? LIMIT ?
                """);
        this.save = session.prepare("""
                INSERT INTO notifications_by_user
                    (user_id, notification_month, notification_id, notification_type, priority,
                     conversation_id, message_bucket, message_id, actor_id, title, body_preview,
                     deep_link, action_payload, is_read, read_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.markRead = session.prepare("""
                UPDATE notifications_by_user SET is_read = true, read_at = ?
                WHERE user_id = ? AND notification_month = ? AND notification_id = ?
                """);
        this.delete = session.prepare("""
                DELETE FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ? AND notification_id = ?
                """);
        this.deleteMonth = session.prepare("""
                DELETE FROM notifications_by_user WHERE user_id = ? AND notification_month = ?
                """);
    }

    @Override
    public CanonicalNotificationSettings findSettings(UUID userId) {
        Row row = session.execute(findSettings.bind(userId)).one();
        return row == null ? null : new CanonicalNotificationSettings(
                row.getUuid("user_id"), row.getString("global_level"), row.getBoolean("push_enabled"),
                row.getBoolean("email_enabled"), row.getBoolean("desktop_enabled"),
                row.getBoolean("sound_enabled"), row.getString("quiet_hours_start"),
                row.getString("quiet_hours_end"), row.getString("timezone"), row.getInstant("updated_at"));
    }

    @Override
    public void saveSettings(CanonicalNotificationSettings settings) {
        session.execute(saveSettings.bind(
                settings.userId(), settings.globalLevel(), settings.pushEnabled(), settings.emailEnabled(),
                settings.desktopEnabled(), settings.soundEnabled(), settings.quietHoursStart(),
                settings.quietHoursEnd(), settings.timezone(), settings.updatedAt()));
    }

    @Override
    public List<CanonicalNotification> findByMonth(UUID userId, String month, int limit) {
        return session.execute(findByMonth.bind(userId, month, limit)).all().stream()
                .map(this::mapNotification).toList();
    }

    @Override
    public void save(CanonicalNotification notification) {
        session.execute(save.bind(
                notification.userId(), notification.notificationMonth(), notification.notificationId(),
                notification.notificationType(), notification.priority(), notification.conversationId(),
                notification.messageBucket(), notification.messageId(), notification.actorId(),
                notification.title(), notification.bodyPreview(), notification.deepLink(),
                notification.actionPayload(), notification.isRead(), notification.readAt(),
                notification.createdAt()));
    }

    @Override
    public void markRead(UUID userId, String month, UUID notificationId) {
        session.execute(markRead.bind(Instant.now(), userId, month, notificationId));
    }

    @Override
    public void delete(UUID userId, String month, UUID notificationId) {
        session.execute(delete.bind(userId, month, notificationId));
    }

    @Override
    public void deleteMonth(UUID userId, String month) {
        session.execute(deleteMonth.bind(userId, month));
    }

    private CanonicalNotification mapNotification(Row row) {
        return new CanonicalNotification(
                row.getUuid("user_id"), row.getString("notification_month"), row.getUuid("notification_id"),
                row.getString("notification_type"), row.getString("priority"), row.getUuid("conversation_id"),
                row.getString("message_bucket"), row.getUuid("message_id"), row.getUuid("actor_id"),
                row.getString("title"), row.getString("body_preview"), row.getString("deep_link"),
                row.getMap("action_payload", String.class, String.class), row.getBoolean("is_read"),
                row.getInstant("read_at"), row.getInstant("created_at"));
    }
}
