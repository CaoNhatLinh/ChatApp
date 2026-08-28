package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class CanonicalNotificationController {
    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;
    private final SimpMessagingTemplate messaging;

    public CanonicalNotificationController(CanonicalBackendService backend,
                                           SecurityContextHelper securityContext,
                                           SimpMessagingTemplate messaging) {
        this.backend = backend;
        this.securityContext = securityContext;
        this.messaging = messaging;
    }

    @GetMapping
    public NotificationPage list(@RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "50") int size) {
        List<CanonicalNotification> notifications = recentNotifications(Math.min(200, (Math.max(0, page) + 1) * bounded(size)));
        int from = Math.min(notifications.size(), Math.max(0, page) * bounded(size));
        List<CanonicalNotification> pageItems = notifications.subList(from, Math.min(notifications.size(), from + bounded(size)));
        return new NotificationPage(pageItems.stream().map(this::toView).toList(), from + pageItems.size() < notifications.size(), !pageItems.isEmpty());
    }

    @GetMapping("/unread")
    public List<NotificationView> unread() {
        return recentNotifications(200).stream()
                .filter(notification -> !Boolean.TRUE.equals(notification.isRead()))
                .map(this::toView)
                .toList();
    }

    @GetMapping("/unread/count")
    public Map<String, Integer> unreadCount() {
        int count = (int) recentNotifications(200).stream()
                .filter(notification -> !Boolean.TRUE.equals(notification.isRead())).count();
        return Map.of("count", count);
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID notificationId) {
        String month = findNotificationMonth(notificationId);
        if (month == null) throw new NotFoundException("notification not found");
        backend.markNotificationRead(actorId(), month, notificationId);
        messaging.convertAndSendToUser(actorId().toString(), "/queue/notification-read",
                Map.of("notificationId", notificationId.toString(), "action", "MARK_READ"));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead() {
        recentNotifications(200).forEach(notification -> {
            String month = findNotificationMonth(notification.notificationId());
            if (month != null) backend.markNotificationRead(actorId(), month, notification.notificationId());
        });
        messaging.convertAndSendToUser(actorId().toString(), "/queue/notification-read",
                Map.of("action", "MARK_ALL_READ"));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/bulk-read")
    public ResponseEntity<Void> markBulkRead(@RequestBody List<UUID> notificationIds) {
        if (notificationIds == null || notificationIds.isEmpty() || notificationIds.size() > 200
                || notificationIds.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BadRequestException("notificationIds must contain 1 to 200 UUIDs");
        }
        notificationIds.forEach(this::markNotificationReadAcrossMonths);
        messaging.convertAndSendToUser(actorId().toString(), "/queue/notification-read",
                Map.of("notificationIds", notificationIds.stream().map(UUID::toString).toList(),
                        "action", "MARK_READ"));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> delete(@PathVariable UUID notificationId) {
        String month = findNotificationMonth(notificationId);
        if (month == null) throw new NotFoundException("notification not found");
        backend.deleteNotification(actorId(), month, notificationId);
        messaging.convertAndSendToUser(actorId().toString(), "/queue/notification-delete",
                Map.of("notificationId", notificationId.toString(), "action", "DELETE"));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAll() {
        YearMonth now = YearMonth.now(ZoneOffset.UTC);
        for (int offset = 0; offset < 12; offset++) {
            backend.deleteNotifications(actorId(), now.minusMonths(offset).toString());
        }
        messaging.convertAndSendToUser(actorId().toString(), "/queue/notification-delete",
                Map.of("action", "DELETE_ALL"));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public NotificationStats stats() {
        List<CanonicalNotification> notifications = recentNotifications(200);
        Map<String, Integer> byType = new LinkedHashMap<>();
        notifications.forEach(notification -> byType.merge(notification.notificationType(), 1, Integer::sum));
        int unread = (int) notifications.stream().filter(item -> !Boolean.TRUE.equals(item.isRead())).count();
        return new NotificationStats(actorId(), notifications.size(), unread, notifications.size() - unread,
                notifications.size(), byType, Instant.now());
    }

    @GetMapping("/type/{type}")
    public NotificationPage byType(@PathVariable String type,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "50") int size) {
        List<NotificationView> filtered = recentNotifications(200).stream()
                .filter(notification -> notification.notificationType().equalsIgnoreCase(type))
                .limit(bounded(size))
                .map(this::toView)
                .toList();
        return new NotificationPage(filtered, false, !filtered.isEmpty());
    }

    @GetMapping("/latest")
    public NotificationView latest() {
        return recentNotifications(1).stream().findFirst().map(this::toView).orElse(null);
    }

    @GetMapping("/settings")
    public CanonicalNotificationSettings settings() {
        return backend.getNotificationSettings(actorId());
    }

    @PutMapping("/settings")
    public ResponseEntity<Void> updateSettings(@RequestBody CanonicalApiContracts.NotificationSettingRequest request) {
        backend.updateNotificationSettings(actorId(), request);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }

    private String currentMonth() {
        return YearMonth.now(ZoneOffset.UTC).toString();
    }

    private int bounded(int size) {
        return Math.max(1, Math.min(200, size));
    }

    private List<CanonicalNotification> recentNotifications(int limit) {
        int boundedLimit = bounded(limit);
        YearMonth now = YearMonth.now(ZoneOffset.UTC);
        List<CanonicalNotification> all = new ArrayList<>();
        for (int offset = 0; offset < 12 && all.size() < boundedLimit; offset++) {
            all.addAll(backend.notifications(actorId(), now.minusMonths(offset).toString(), boundedLimit));
        }
        return all.stream()
                .sorted(Comparator.comparing(CanonicalNotification::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(boundedLimit)
                .toList();
    }

    private String findNotificationMonth(UUID notificationId) {
        YearMonth now = YearMonth.now(ZoneOffset.UTC);
        for (int offset = 0; offset < 12; offset++) {
            String month = now.minusMonths(offset).toString();
            if (backend.notifications(actorId(), month, 200).stream()
                    .anyMatch(item -> item.notificationId().equals(notificationId))) {
                return month;
            }
        }
        return null;
    }

    private void markNotificationReadAcrossMonths(UUID notificationId) {
        String month = findNotificationMonth(notificationId);
        if (month == null) throw new NotFoundException("notification not found: " + notificationId);
        backend.markNotificationRead(actorId(), month, notificationId);
    }

    private NotificationView toView(CanonicalNotification notification) {
        return new NotificationView(notification.notificationId().toString(), notification.userId().toString(),
                notification.notificationType(), notification.title(), notification.bodyPreview(),
                Boolean.TRUE.equals(notification.isRead()), notification.createdAt(), notification.actionPayload());
    }

    public record NotificationPage(List<NotificationView> content, boolean hasNext, boolean hasContent) {
    }

    public record NotificationView(String notificationId, String userId, String type, String title, String body,
                                   boolean isRead, Instant createdAt, Map<String, String> metadata) {
    }

    public record NotificationStats(UUID userId, int totalCount, int unreadCount, int readCount, int weeklyCount,
                                    Map<String, Integer> typeStats, Instant lastUpdated) {
    }
}
