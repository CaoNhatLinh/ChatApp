package com.chatapp.chat_service.canonical.notification;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository {
    CanonicalNotificationSettings findSettings(UUID userId);

    void saveSettings(CanonicalNotificationSettings settings);

    List<CanonicalNotification> findByMonth(UUID userId, String month, int limit);

    void save(CanonicalNotification notification);

    void markRead(UUID userId, String month, UUID notificationId);

    void delete(UUID userId, String month, UUID notificationId);

    void deleteMonth(UUID userId, String month);
}
