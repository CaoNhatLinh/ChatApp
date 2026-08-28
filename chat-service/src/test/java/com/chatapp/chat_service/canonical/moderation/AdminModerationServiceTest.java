package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminModerationServiceTest {
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final AdminModerationService service = new AdminModerationService(repository, store, authorization, events);

    @Test
    void reportQueueRequiresReportManage() {
        UUID actor = UUID.randomUUID();
        service.listReports(actor, "OPEN", "2026-08-28", 50);
        verify(authorization).require(actor, AppPermission.REPORT_MANAGE);
        verify(repository).listReports(eq("OPEN"), eq(LocalDate.of(2026, 8, 28)), eq(50));
    }

    @Test
    void terminalResolutionRequiresResolutionCodeAndReason() {
        UUID actor = UUID.randomUUID();
        AdminModerationService.ResolveReportRequest request = new AdminModerationService.ResolveReportRequest(
                "OPEN", LocalDate.of(2026, 8, 28), UUID.randomUUID(), "RESOLVED", null, null, "");

        assertThatThrownBy(() -> service.resolveReport(actor, UUID.randomUUID(), request))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).findReport(anyString(), any(), any());
    }

    @Test
    void sanctionRequiresAnExistingUser() {
        UUID actor = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        when(store.findUserById(target)).thenReturn(null);

        assertThatThrownBy(() -> service.imposeSanction(actor,
                new AdminModerationService.SanctionRequest(target, "APP", null, "BAN", null, null, "ABUSE", "reason")))
                .hasMessage("user not found");
        verify(repository, never()).createSanction(any(), anyString(), any(), anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void revokingOneAppLockDoesNotRestoreStatusWhileAnotherLockIsActive() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID sanctionId = UUID.randomUUID();
        ModerationRepository.SanctionRow revoked = new ModerationRepository.SanctionRow(
                userId, UUID.randomUUID(), sanctionId, "APP", null, "BAN",
                Instant.now().minusSeconds(300), Instant.now().plusSeconds(30), actorId,
                "ABUSE", "test", "REVOKED", actorId, Instant.now());
        when(repository.revokeSanction(actorId, userId, revoked.imposedAt(), sanctionId)).thenReturn(revoked);
        when(store.findUserById(userId)).thenReturn(new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser(
                userId, "target", "target", "target@example.com", "target@example.com", "hash",
                "LOCAL", null, "Target", null, "BANNED", Instant.now(), Instant.now(), null));
        when(repository.hasActiveAppAccountLock(eq(userId), any(Instant.class))).thenReturn(true);

        service.revokeSanction(actorId, userId, revoked.imposedAt(), sanctionId, "duplicate sanction");

        verify(store, never()).updateUserAccountStatus(any(), anyString(), any());
    }
}
