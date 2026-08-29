package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanonicalNotificationControllerTest {

    @Mock
    private CanonicalBackendService backend;
    @Mock
    private SecurityContextHelper securityContext;
    @Mock
    private SimpMessagingTemplate messaging;

    @Test
    void filtersByTypeBeforeApplyingRequestedPage() {
        UUID actorId = UUID.randomUUID();
        CanonicalNotification newest = notification("MESSAGE", Instant.parse("2026-08-29T10:00:00Z"));
        CanonicalNotification second = notification("MESSAGE", Instant.parse("2026-08-29T09:00:00Z"));
        CanonicalNotification otherType = notification("FRIEND_REQUEST", Instant.parse("2026-08-29T08:00:00Z"));
        when(securityContext.getCurrentUserId()).thenReturn(actorId);
        AtomicBoolean firstResponse = new AtomicBoolean(true);
        when(backend.notifications(org.mockito.ArgumentMatchers.eq(actorId), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(200)))
                .thenAnswer(invocation -> firstResponse.getAndSet(false)
                        ? List.of(newest, second, otherType)
                        : List.of());

        CanonicalNotificationController controller = new CanonicalNotificationController(backend, securityContext, messaging);

        CanonicalNotificationController.NotificationPage result = controller.byType("message", 1, 1);

        assertThat(result.content()).extracting(CanonicalNotificationController.NotificationView::notificationId)
                .containsExactly(second.notificationId().toString());
        assertThat(result.hasContent()).isTrue();
        assertThat(result.hasNext()).isFalse();
    }

    @Test
    void reportsRollingSevenDayCountSeparatelyFromTotalCount() {
        UUID actorId = UUID.randomUUID();
        Instant now = Instant.now();
        CanonicalNotification recent = notification("MESSAGE", now.minusSeconds(2 * 24 * 60 * 60L));
        CanonicalNotification older = notification("MESSAGE", now.minusSeconds(8 * 24 * 60 * 60L));
        when(securityContext.getCurrentUserId()).thenReturn(actorId);
        when(backend.notifications(org.mockito.ArgumentMatchers.eq(actorId), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(200)))
                .thenAnswer(invocation -> YearMonth.now(ZoneOffset.UTC).toString().equals(invocation.getArgument(1))
                        ? List.of(recent, older)
                        : List.of());

        CanonicalNotificationController controller = new CanonicalNotificationController(backend, securityContext, messaging);

        CanonicalNotificationController.NotificationStats result = controller.stats();

        assertThat(result.totalCount()).isEqualTo(2);
        assertThat(result.weeklyCount()).isEqualTo(1);
    }

    private static CanonicalNotification notification(String type, Instant createdAt) {
        UUID notificationId = UUID.randomUUID();
        return new CanonicalNotification(
                UUID.randomUUID(), "2026-08", notificationId, type, "NORMAL", UUID.randomUUID(),
                "2026-08-29-10", UUID.randomUUID(), UUID.randomUUID(), "Title", "Body", "/app",
                java.util.Map.of(), false, null, createdAt);
    }
}
