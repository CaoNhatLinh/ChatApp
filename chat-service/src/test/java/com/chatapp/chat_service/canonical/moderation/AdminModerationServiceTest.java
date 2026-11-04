package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminModerationServiceTest {
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ConversationModerationRepository conversationModeration = mock(ConversationModerationRepository.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final AdminModerationService service = new AdminModerationService(
            repository, store, users, conversationModeration, authorization, events);

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
        verifyNoInteractions(repository, events);
    }

    @Test
    void resolutionUsesExactQueueKeyAndDoesNotSubstituteAnotherReport() {
        UUID actor = UUID.randomUUID(), reportId = UUID.randomUUID(), createdAt = Uuids.timeBased();
        LocalDate day = LocalDate.of(2026, 10, 23);
        assertThatThrownBy(() -> service.resolveReport(actor, reportId,
                new AdminModerationService.ResolveReportRequest(
                        "OPEN", day, createdAt, "RESOLVED", null, "REVIEWED", "Checked evidence")))
                .isInstanceOf(NotFoundException.class);
        verify(authorization).require(actor, AppPermission.REPORT_MANAGE);
        verify(repository).findReport("OPEN", day, createdAt, reportId);
        verifyNoMoreInteractions(repository);
        verifyNoInteractions(events);
    }

    @Test
    void concurrentDecisionLoserReturnsConflictWithoutAudit() {
        UUID actor = UUID.randomUUID(), reportId = UUID.randomUUID(), createdAt = Uuids.timeBased();
        LocalDate day = LocalDate.now();
        var current = new ModerationRepository.ReportRow(reportId, createdAt, day, "OPEN",
                UUID.randomUUID(), "USER", UUID.randomUUID(), null, null, null,
                "SPAM", null, null, null, null);
        when(repository.findReport("OPEN", day, createdAt, reportId)).thenReturn(current);
        assertThatThrownBy(() -> service.resolveReport(actor, reportId,
                new AdminModerationService.ResolveReportRequest(
                        "OPEN", day, createdAt, "RESOLVED", null, "REVIEWED", "Checked evidence")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("report changed; reload before deciding");
        verify(repository).transitionReport(eq(current), eq("RESOLVED"), eq(actor), any(Instant.class),
                eq("REVIEWED"), eq(actor), eq("Checked evidence"), any(UUID.class));
        verifyNoInteractions(events);
    }

    @Test
    void winningDecisionUsesTheSameIdentityForPersistenceAndAudit() {
        UUID actor = UUID.randomUUID(), reportId = UUID.randomUUID(), createdAt = Uuids.timeBased();
        UUID reporter = UUID.randomUUID(), target = UUID.randomUUID(), conversation = UUID.randomUUID();
        LocalDate day = LocalDate.of(2026, 11, 3);
        var current = new ModerationRepository.ReportRow(reportId, createdAt, day, "OPEN",
                reporter, "CONVERSATION", target, conversation, null, null,
                "SPAM", null, null, null, null);
        var updated = new ModerationRepository.ReportRow(reportId, createdAt, day, "IN_REVIEW",
                reporter, "CONVERSATION", target, conversation, null, null,
                "SPAM", null, actor, null, null);
        when(repository.findReport("OPEN", day, createdAt, reportId)).thenReturn(current);
        when(repository.transitionReport(eq(current), eq("IN_REVIEW"), eq(actor), isNull(),
                isNull(), eq(actor), eq("Checked evidence"), any(UUID.class))).thenReturn(updated);

        assertThat(service.resolveReport(actor, reportId, new AdminModerationService.ResolveReportRequest(
                "OPEN", day, createdAt, "IN_REVIEW", null, null, "  Checked evidence  "))).isEqualTo(updated);

        var decisionId = ArgumentCaptor.forClass(UUID.class);
        var order = inOrder(repository, events);
        order.verify(repository).transitionReport(eq(current), eq("IN_REVIEW"), eq(actor), isNull(),
                isNull(), eq(actor), eq("Checked evidence"), decisionId.capture());
        assertThat(decisionId.getValue().version()).isEqualTo(1);
        order.verify(events).recordWithIdentity(decisionId.getValue(), actor, conversation,
                "REPORT_STATUS_UPDATE", "report", reportId.toString(), target, "Checked evidence",
                Map.of("status", "OPEN"), Map.of("status", "IN_REVIEW", "resolutionCode", ""));
        order.verify(repository).markReportEnqueued(ModerationRepository.reportWorkKey(current));
        verifyNoMoreInteractions(events);
    }

    @Test
    void rejectsReopeningOrChangingTerminalReportsBeforeStorage() {
        for (String status : new String[]{"RESOLVED", "DISMISSED", "IN_REVIEW"}) {
            assertThatThrownBy(() -> service.resolveReport(UUID.randomUUID(), UUID.randomUUID(),
                    new AdminModerationService.ResolveReportRequest(status, LocalDate.now(),
                            Uuids.timeBased(), "OPEN", null, null, "Reopen")))
                    .isInstanceOf(ConflictException.class);
        }
        verifyNoInteractions(repository, events);
    }

    @Test
    void rejectsRandomUuidBeforeBindingTimeuuidColumn() {
        assertThatThrownBy(() -> service.resolveReport(UUID.randomUUID(), UUID.randomUUID(),
                new AdminModerationService.ResolveReportRequest("OPEN", LocalDate.now(),
                        UUID.randomUUID(), "IN_REVIEW", null, null, "Review")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("createdAtKey must be a timeuuid");
        verifyNoInteractions(repository, events);
    }

    @Test
    void sanctionRequiresAnExistingUser() {
        UUID actor = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        when(users.findById(target)).thenReturn(null);

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
        when(users.findById(userId)).thenReturn(new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser(
                userId, "target", "target", "target@example.com", "target@example.com", "hash",
                "LOCAL", null, "Target", null, "BANNED", Instant.now(), Instant.now(), null));
        when(repository.hasActiveAppAccountLock(eq(userId), any(Instant.class))).thenReturn(true);

        service.revokeSanction(actorId, userId, revoked.imposedAt(), sanctionId, "duplicate sanction");

        verify(users, never()).updateAccountStatus(any(), anyString(), any());
    }
}
