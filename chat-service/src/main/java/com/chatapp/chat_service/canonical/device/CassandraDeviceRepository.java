package com.chatapp.chat_service.canonical.device;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Repository
public class CassandraDeviceRepository implements DeviceRepository {
    private final CqlSession session;
    private final PreparedStatement findByUser;
    private final PreparedStatement findOne;
    private final PreparedStatement save;
    private final PreparedStatement touch;
    private final PreparedStatement deactivate;

    public CassandraDeviceRepository(CqlSession session) {
        this.session = session;
        this.findByUser = session.prepare("""
                SELECT device_id, platform, push_provider, device_name, app_version,
                       is_active, created_at, last_seen_at
                FROM user_devices_by_user WHERE user_id = ? LIMIT ?
                """);
        this.findOne = session.prepare("""
                SELECT device_id, platform, push_provider, device_name, app_version,
                       is_active, created_at, last_seen_at
                FROM user_devices_by_user WHERE user_id = ? AND device_id = ?
                """);
        this.save = session.prepare("""
                INSERT INTO user_devices_by_user
                    (user_id, device_id, platform, push_provider, push_token, device_name,
                     app_version, is_active, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, ?)
                """);
        this.touch = session.prepare("""
                UPDATE user_devices_by_user SET last_seen_at = ?
                WHERE user_id = ? AND device_id = ? IF is_active = true
                """);
        this.deactivate = session.prepare("""
                UPDATE user_devices_by_user SET is_active = false, last_seen_at = ?
                WHERE user_id = ? AND device_id = ? IF is_active = true
                """);
    }

    @Override public List<DeviceSession> findByUser(UUID userId, int limit) {
        return session.execute(findByUser.bind(userId, Math.max(1, Math.min(200, limit))))
                .all().stream().map(this::map).toList();
    }

    @Override public DeviceSession save(UUID userId, UUID deviceId, String platform, String provider,
                                        String token, String name, String version, Instant seenAt) {
        var existing = session.execute(findOne.bind(userId, deviceId)).one();
        Instant createdAt = existing == null ? seenAt
                : Objects.requireNonNull(existing.getInstant("created_at"), "device created_at is required");
        session.execute(save.bind(userId, deviceId, platform, provider, token, name, version, createdAt, seenAt));
        return new DeviceSession(deviceId, platform, provider, name, version, true, createdAt, seenAt);
    }

    @Override public boolean touch(UUID userId, UUID deviceId, Instant seenAt) {
        return session.execute(touch.bind(seenAt, userId, deviceId)).wasApplied();
    }

    @Override public boolean deactivate(UUID userId, UUID deviceId, Instant seenAt) {
        return session.execute(deactivate.bind(seenAt, userId, deviceId)).wasApplied();
    }

    private DeviceSession map(com.datastax.oss.driver.api.core.cql.Row row) {
        return new DeviceSession(row.getUuid("device_id"), row.getString("platform"),
                row.getString("push_provider"), row.getString("device_name"), row.getString("app_version"),
                row.getBoolean("is_active"), row.getInstant("created_at"), row.getInstant("last_seen_at"));
    }
}
