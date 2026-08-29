package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminAuditServiceTest {
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final AdminAuditService service = new AdminAuditService(store, authorization);

    @Test
    void auditTimelineRequiresAuditReadAndUsesBoundedMonth() {
        UUID actorId = UUID.randomUUID();
        when(store.listAuditEvents("2026-08", 50)).thenReturn(List.of());

        assertThat(service.list(actorId, "2026-08", 50)).isEmpty();

        verify(authorization).require(actorId, AppPermission.AUDIT_READ);
        verify(store).listAuditEvents("2026-08", 50);
    }

    @Test
    void malformedMonthIsRejectedBeforeStoreRead() {
        UUID actorId = UUID.randomUUID();

        assertThatThrownBy(() -> service.list(actorId, "2026/08", 50))
                .isInstanceOf(BadRequestException.class);
        verify(store, never()).listAuditEvents(anyString(), anyInt());
    }

    @Test
    void exportUsesTheBoundedAuditListAndEscapesCsvValues() {
        UUID actorId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        when(store.listAuditEvents("2026-08", 200)).thenReturn(List.of(new CanonicalCqlStore.AuditEventRow(
                "2026-08", eventId, "REPORT_RESOLVE", "report", "report-1", actorId,
                null, null, "SUCCESS", "reason,with\"quote", Map.of("z", "last", "a", "first"),
                Map.of("status", "RESOLVED"), null, Instant.parse("2026-08-20T10:15:30Z"))));

        String csv = service.export(actorId, "2026-08", 999);

        assertThat(csv).startsWith("eventMonth,eventId,action,resourceType,resourceId,actorId,conversationId,targetUserId,");
        assertThat(csv).contains("\"reason,with\"\"quote\"");
        assertThat(csv).contains("\"a=first;z=last\"");
        verify(authorization).require(actorId, AppPermission.AUDIT_READ);
        verify(store).listAuditEvents("2026-08", 200);
    }
}
