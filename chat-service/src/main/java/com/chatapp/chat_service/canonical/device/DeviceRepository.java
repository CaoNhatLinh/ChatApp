package com.chatapp.chat_service.canonical.device;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface DeviceRepository {
    List<DeviceSession> findByUser(UUID userId, int limit);
    DeviceSession save(UUID userId, UUID deviceId, String platform, String pushProvider,
                       String pushToken, String deviceName, String appVersion, Instant seenAt);
    boolean touch(UUID userId, UUID deviceId, Instant seenAt);
    boolean deactivate(UUID userId, UUID deviceId, Instant seenAt);

    record DeviceSession(UUID deviceId, String platform, String pushProvider, String deviceName,
                         String appVersion, boolean active, Instant createdAt, Instant lastSeenAt) {}
}
