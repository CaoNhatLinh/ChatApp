package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminAnalyticsServiceTest {
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final AdminAnalyticsService service = new AdminAnalyticsService(store, authorization);

    @Test
    void analyticsRequiresPermissionAndUsesBoundedRange() {
        UUID actorId = UUID.randomUUID();
        LocalDate day = LocalDate.of(2026, 8, 28);
        CanonicalAnalyticsPoint point = new CanonicalAnalyticsPoint(
                day, "MESSAGE_SENT", 1, UUID.randomUUID(), UUID.randomUUID(), null, java.util.Map.of());
        when(store.listAnalytics(day, "MESSAGE_SENT", 10)).thenReturn(List.of(point));

        assertThat(service.list(actorId, day, day, "MESSAGE_SENT", 10)).containsExactly(point);
        verify(authorization).require(actorId, AppPermission.ANALYTICS_READ);
        verify(store).listAnalytics(day, "MESSAGE_SENT", 10);
    }

    @Test
    void analyticsRejectsUnboundedDateRangesAndUnknownTypes() {
        UUID actorId = UUID.randomUUID();
        LocalDate start = LocalDate.of(2026, 1, 1);
        assertThatThrownBy(() -> service.list(actorId, start, start.plusDays(31), "ALL", 10))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("analytics range must be between 1 and 31 days");
        assertThatThrownBy(() -> service.list(actorId, start, start, "SECRETS", 10))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("unsupported analytics event type");
        verifyNoInteractions(store);
    }
}
