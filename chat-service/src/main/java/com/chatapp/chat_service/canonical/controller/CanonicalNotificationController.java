package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.notification.NotificationSettingsRequest;
import com.chatapp.chat_service.canonical.notification.NotificationService.NotificationPage;
import com.chatapp.chat_service.canonical.notification.NotificationService.NotificationStats;
import com.chatapp.chat_service.canonical.notification.NotificationService.NotificationView;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class CanonicalNotificationController {
    private final NotificationService notifications;
    private final SecurityContextHelper securityContext;

    public CanonicalNotificationController(
            NotificationService notifications,
            SecurityContextHelper securityContext) {
        this.notifications = notifications;
        this.securityContext = securityContext;
    }

    @GetMapping
    public NotificationPage list(@RequestParam(defaultValue = "0") int page,
                                 @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return notifications.list(actorId(), page, limit);
    }

    @GetMapping("/unread")
    public List<NotificationView> unread() {
        return notifications.unread(actorId());
    }

    @GetMapping("/unread/count")
    public Map<String, Integer> unreadCount() {
        return notifications.unreadCount(actorId());
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID notificationId) {
        notifications.markRead(actorId(), notificationId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead() {
        notifications.markAllRead(actorId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/bulk-read")
    public ResponseEntity<Void> markBulkRead(@RequestBody List<UUID> notificationIds) {
        notifications.markBulkRead(actorId(), notificationIds);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> delete(@PathVariable UUID notificationId) {
        notifications.delete(actorId(), notificationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAll() {
        notifications.deleteAll(actorId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public NotificationStats stats() {
        return notifications.stats(actorId());
    }

    @GetMapping("/type/{type}")
    public NotificationPage byType(@PathVariable String type,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return notifications.byType(actorId(), type, page, limit);
    }

    @GetMapping("/latest")
    public NotificationView latest() {
        return notifications.latest(actorId());
    }

    @GetMapping("/settings")
    public CanonicalNotificationSettings settings() {
        return notifications.getSettings(actorId());
    }

    @PutMapping("/settings")
    public ResponseEntity<Void> updateSettings(@RequestBody @Valid NotificationSettingsRequest request) {
        notifications.updateSettings(actorId(), request);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }

}
