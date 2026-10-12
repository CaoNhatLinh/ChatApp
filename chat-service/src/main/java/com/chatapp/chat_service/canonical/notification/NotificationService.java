package com.chatapp.chat_service.canonical.notification;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class NotificationService {
    private final NotificationRepository notifications;
    private final RealtimePublisher realtime;
    private final MessageRepository messages;

    public NotificationService(NotificationRepository notifications, RealtimePublisher realtime, MessageRepository messages) {
        this.notifications = notifications;
        this.realtime = realtime;
        this.messages = messages;
    }

    public NotificationPage list(UUID userId, int page, int requestedLimit) {
        requireUser(userId);
        int pageSize = bounded(requestedLimit);
        List<CanonicalNotification> notifications = recent(
                userId, Math.min(200, (Math.max(0, page) + 1) * pageSize));
        int from = Math.min(notifications.size(), Math.max(0, page) * pageSize);
        List<CanonicalNotification> items = notifications.subList(
                from, Math.min(notifications.size(), from + pageSize));
        return new NotificationPage(
                items.stream().map(this::toView).toList(),
                from + items.size() < notifications.size(),
                !items.isEmpty());
    }

    public List<NotificationView> unread(UUID userId) {
        requireUser(userId);
        return recent(userId, 200).stream()
                .filter(notification -> !Boolean.TRUE.equals(notification.isRead()))
                .map(this::toView)
                .toList();
    }

    public Map<String, Integer> unreadCount(UUID userId) {
        return Map.of("count", unread(userId).size());
    }

    public void markRead(UUID userId, UUID notificationId) {
        requireUser(userId);
        String month = findMonth(userId, notificationId);
        if (month == null) throw new NotFoundException("notification not found");
        notifications.markRead(userId, month, notificationId);
        realtime.publishToUser(userId, "/queue/notification-read",
                Map.of("notificationId", notificationId.toString(), "action", "MARK_READ"));
    }

    public void markAllRead(UUID userId) {
        requireUser(userId);
        recent(userId, 200).forEach(notification -> {
            String month = findMonth(userId, notification.notificationId());
            if (month != null) {
                notifications.markRead(userId, month, notification.notificationId());
            }
        });
        realtime.publishToUser(userId, "/queue/notification-read", Map.of("action", "MARK_ALL_READ"));
    }

    public void markBulkRead(UUID userId, List<UUID> notificationIds) {
        requireUser(userId);
        if (notificationIds == null || notificationIds.isEmpty() || notificationIds.size() > 200
                || notificationIds.stream().anyMatch(Objects::isNull)) {
            throw new BadRequestException("notificationIds must contain 1 to 200 UUIDs");
        }
        notificationIds.forEach(notificationId -> {
            String month = findMonth(userId, notificationId);
            if (month == null) throw new NotFoundException("notification not found: " + notificationId);
            notifications.markRead(userId, month, notificationId);
        });
        realtime.publishToUser(userId, "/queue/notification-read",
                Map.of("notificationIds", notificationIds.stream().map(UUID::toString).toList(),
                        "action", "MARK_READ"));
    }

    public void delete(UUID userId, UUID notificationId) {
        requireUser(userId);
        String month = findMonth(userId, notificationId);
        if (month == null) throw new NotFoundException("notification not found");
        notifications.delete(userId, month, notificationId);
        realtime.publishToUser(userId, "/queue/notification-delete",
                Map.of("notificationId", notificationId.toString(), "action", "DELETE"));
    }

    public void deleteAll(UUID userId) {
        requireUser(userId);
        YearMonth now = YearMonth.now(ZoneOffset.UTC);
        for (int offset = 0; offset < 12; offset++) {
            notifications.deleteMonth(userId, now.minusMonths(offset).toString());
        }
        realtime.publishToUser(userId, "/queue/notification-delete", Map.of("action", "DELETE_ALL"));
    }

    public NotificationStats stats(UUID userId) {
        requireUser(userId);
        List<CanonicalNotification> notifications = recent(userId, 200);
        Map<String, Integer> byType = new LinkedHashMap<>();
        notifications.forEach(notification -> byType.merge(notification.notificationType(), 1, Integer::sum));
        int unread = (int) notifications.stream().filter(item -> !Boolean.TRUE.equals(item.isRead())).count();
        Instant weekStart = Instant.now().minus(7, ChronoUnit.DAYS);
        int weekly = (int) notifications.stream()
                .filter(item -> item.createdAt() != null && !item.createdAt().isBefore(weekStart))
                .count();
        return new NotificationStats(
                userId, notifications.size(), unread, notifications.size() - unread, weekly, byType, Instant.now());
    }

    public NotificationPage byType(UUID userId, String type, int page, int requestedLimit) {
        requireUser(userId);
        int pageSize = bounded(requestedLimit);
        List<NotificationView> filtered = recent(userId, 200).stream()
                .filter(notification -> notification.notificationType().equalsIgnoreCase(type))
                .map(this::toView)
                .toList();
        int from = Math.min(filtered.size(), Math.max(0, page) * pageSize);
        List<NotificationView> items = filtered.subList(from, Math.min(filtered.size(), from + pageSize));
        return new NotificationPage(items, from + items.size() < filtered.size(), !items.isEmpty());
    }

    public NotificationView latest(UUID userId) {
        requireUser(userId);
        return recent(userId, 1).stream().findFirst().map(this::toView).orElse(null);
    }

    public CanonicalNotificationSettings getSettings(UUID userId) {
        requireUser(userId);
        CanonicalNotificationSettings settings = notifications.findSettings(userId);
        if (settings == null) {
            settings = new CanonicalNotificationSettings(
                    userId, "ALL", true, true, true, true, null, null, "UTC", Instant.now());
            notifications.saveSettings(settings);
        }
        return settings;
    }

    public void updateSettings(UUID userId, NotificationSettingsRequest request) {
        requireUser(userId);
        if (request == null) {
            throw new BadRequestException("notification settings are required");
        }
        notifications.saveSettings(new CanonicalNotificationSettings(
                userId,
                NotificationSettingsPolicy.requireLevel(request.globalLevel()),
                NotificationSettingsPolicy.requireBoolean(request.pushEnabled(), "pushEnabled"),
                NotificationSettingsPolicy.requireBoolean(request.emailEnabled(), "emailEnabled"),
                NotificationSettingsPolicy.requireBoolean(request.desktopEnabled(), "desktopEnabled"),
                NotificationSettingsPolicy.requireBoolean(request.soundEnabled(), "soundEnabled"),
                NotificationSettingsPolicy.normalizeClock(request.quietHoursStart(), "quietHoursStart"),
                NotificationSettingsPolicy.normalizeClock(request.quietHoursEnd(), "quietHoursEnd"),
                NotificationSettingsPolicy.normalizeTimezone(request.timezone()),
                Instant.now()));
    }

    public void notifyJoinRequestResolved(
            UUID userId,
            UUID notificationId,
            UUID conversationId,
            UUID actorId,
            boolean approved) {
        requireUser(userId);
        Instant now = Instant.now();
        CanonicalNotification notification = new CanonicalNotification(
                userId,
                YearMonth.now(ZoneOffset.UTC).toString(),
                notificationId,
                approved ? "JOIN_REQUEST_APPROVED" : "JOIN_REQUEST_DECLINED",
                "NORMAL",
                conversationId,
                null,
                null,
                actorId,
                approved ? "Yêu cầu tham gia đã được duyệt" : "Yêu cầu tham gia đã bị từ chối",
                approved ? "Bạn có thể mở phòng và tiếp tục cuộc trò chuyện."
                        : "Phòng chưa chấp nhận yêu cầu tham gia lần này.",
                approved ? "/app?conversationId=" + conversationId : null,
                Map.of(
                        "conversationId", conversationId.toString(),
                        "decision", approved ? "APPROVED" : "DECLINED"),
                false,
                null,
                now);
        publish(notification);
    }

    public void publish(CanonicalNotification notification) {
        notifications.save(notification);
        realtime.publishToUser(notification.userId(), "/queue/notifications", Map.of(
                "notificationId", notification.notificationId().toString(),
                "userId", notification.userId().toString(),
                "type", notification.notificationType(),
                "title", notification.title(),
                "body", notification.bodyPreview(),
                "isRead", false,
                "createdAt", notification.createdAt().toString(),
                "metadata", notification.actionPayload()));
    }

    private List<CanonicalNotification> recent(UUID userId, int requestedLimit) {
        int limit = bounded(requestedLimit);
        YearMonth now = YearMonth.now(ZoneOffset.UTC);
        List<CanonicalNotification> all = new ArrayList<>();
        for (int offset = 0; offset < 12 && all.size() < limit; offset++) {
            all.addAll(notifications.findByMonth(userId, now.minusMonths(offset).toString(), limit));
        }
        return all.stream()
                .sorted(Comparator.comparing(
                        CanonicalNotification::createdAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .toList();
    }

    private String findMonth(UUID userId, UUID notificationId) {
        YearMonth now = YearMonth.now(ZoneOffset.UTC);
        for (int offset = 0; offset < 12; offset++) {
            String month = now.minusMonths(offset).toString();
            if (notifications.findByMonth(userId, month, 200).stream()
                    .anyMatch(item -> item.notificationId().equals(notificationId))) {
                return month;
            }
        }
        return null;
    }

    private int bounded(int size) {
        return Math.max(1, Math.min(200, size));
    }

    private void requireUser(UUID userId) {
        if (userId == null) throw new ForbiddenException("auth required");
    }

    private NotificationView toView(CanonicalNotification notification) {
        String body = notification.bodyPreview();
        if (notification.messageId() != null) {
            var current = messages.find(notification.conversationId(), notification.messageBucket(), notification.messageId());
            if (current == null || Boolean.TRUE.equals(current.isDeleted())) body = "";
        }
        return new NotificationView(
                notification.notificationId().toString(), notification.userId().toString(),
                notification.notificationType(), notification.title(), body,
                Boolean.TRUE.equals(notification.isRead()), notification.createdAt(), notification.actionPayload());
    }

    public record NotificationPage(List<NotificationView> content, boolean hasNext, boolean hasContent) {
    }

    public record NotificationView(
            String notificationId, String userId, String type, String title, String body,
            boolean isRead, Instant createdAt, Map<String, String> metadata) {
    }

    public record NotificationStats(
            UUID userId, int totalCount, int unreadCount, int readCount, int weeklyCount,
            Map<String, Integer> typeStats, Instant lastUpdated) {
    }
}
