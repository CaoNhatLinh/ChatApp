package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.messaging.CassandraOutboxPublisher;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.moderation.ModerationRepository.ReportRow;
import com.chatapp.chat_service.canonical.moderation.ModerationRepository.ReportWorkAuthority;
import com.chatapp.chat_service.canonical.moderation.ModerationRepository.ReportWorkKey;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ReportDecisionRecoveryTest {
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final ReportDecisionRecovery recovery = new ReportDecisionRecovery(repository, events, Optional.empty());
    private final UUID actor = UUID.randomUUID();
    private final UUID conversation = UUID.randomUUID();
    private final UUID targetUser = UUID.randomUUID();
    private final Instant decisionTime = Instant.parse("2025-12-31T23:59:59.999Z");
    private final UUID decisionId = Uuids.startOf(decisionTime.toEpochMilli());

    @Test
    void sweepsPreparedCommandsBeforeDecisionWorkAndRetainsFailedRowsForAnotherPass() {
        var command = new ModerationRepository.CreateCommand("fingerprint", decisionId, UUID.randomUUID(), targetUser);
        var preparation = new ModerationRepository.CreatePreparation((byte) 0, actor, UUID.randomUUID(), command,
                "CONVERSATION", conversation, null, null, "ABUSE", "details");
        when(repository.createPreparationPage((byte) 0, null, 25)).thenReturn(List.of(preparation));
        when(repository.resumePreparedCreate(preparation)).thenThrow(new IllegalStateException("seed interrupted"))
                .thenReturn(null);

        recovery.recover();
        var order = inOrder(repository);
        order.verify(repository).createPreparationPage((byte) 0, null, 25);
        order.verify(repository).resumePreparedCreate(preparation);
        order.verify(repository).reportWorkPage((byte) 0, null, 25);

        for (int tick = 0; tick < 2 * ModerationRepository.REPORT_WORK_SHARDS; tick++) recovery.recover();
        verify(repository).createPreparationPage((byte) 0, preparation.cursor(), 25);
        verify(repository, times(2)).resumePreparedCreate(preparation);
    }

    @Test
    void creationRecoveryRetriesWithTheSameIdentityAndLeavesCurrentDecisionAlone() {
        var decision = key();
        var key = new ReportWorkKey(decision.shard(), decision.reportId(), ModerationRepository.CREATE_WORK,
                decision.reporterId(), decision.createdAt());
        var report = authority(decision, Map.of()).report();
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(new ReportWorkAuthority(report, Map.of()));
        doThrow(new IllegalStateException("outbox unavailable")).doNothing().when(events).recoverReportCreation(
                report.createdAtKey(), report.reportId(), report.reporterId(), report.conversationId(),
                report.targetUserId(), report.reasonCode(), report.targetType());

        recovery.recover();
        verify(repository, never()).removeReportWork(key);
        new ReportDecisionRecovery(repository, events, Optional.empty()).recover();

        verify(events, times(2)).recoverReportCreation(report.createdAtKey(), report.reportId(), report.reporterId(),
                report.conversationId(), report.targetUserId(), report.reasonCode(), report.targetType());
        verify(repository).removeReportWork(key);
        verify(repository, never()).replayReportProjection(any(), any());
    }

    @Test
    void replaysProjectionThenWritesSameAuditIdentityBeforeMarkingRecovery() {
        var key = key();
        var authority = authority(key, Map.of());
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(authority);

        recovery.recover();

        var order = inOrder(repository, events);
        var audit = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        order.verify(repository).replayReportProjection(key, authority);
        order.verify(events).restoreReportAudit(audit.capture());
        order.verify(repository).markReportAuditRecovered(key);
        verify(repository, never()).removeReportWork(key);
        verify(repository, never()).markReportEnqueued(key);
        verify(events, never()).enqueueRecoveredReport(any());
        assertThat(audit.getValue().eventId()).isEqualTo(decisionId);
        assertThat(audit.getValue().eventMonth()).isEqualTo("2025-12");
        assertThat(audit.getValue().createdAt()).isEqualTo(decisionTime);
        assertThat(audit.getValue().actorId()).isEqualTo(actor);
        assertThat(audit.getValue().conversationId()).isEqualTo(conversation);
        assertThat(audit.getValue().targetUserId()).isEqualTo(targetUser);
        assertThat(audit.getValue().action()).isEqualTo("REPORT_STATUS_UPDATE");
        assertThat(audit.getValue().resourceId()).isEqualTo(key.reportId().toString());
        assertThat(audit.getValue().reasonCode()).isEqualTo("Checked evidence");
        assertThat(audit.getValue().beforeState()).containsExactlyEntriesOf(Map.of("status", "OPEN"));
        assertThat(audit.getValue().afterState())
                .containsExactlyInAnyOrderEntriesOf(Map.of("status", "RESOLVED", "resolutionCode", "REVIEWED"));
    }

    @Test
    void shardedRecoveryEnqueuesTheRebuiltAuditBeforeMarkingWorkComplete() {
        var key = key();
        var authority = authority(key, Map.of("outboxRoute", "sharded-v1"));
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(authority);

        recovery.recover();

        var order = inOrder(repository, events);
        var audit = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        order.verify(repository).replayReportProjection(key, authority);
        order.verify(events).restoreReportAudit(audit.capture());
        order.verify(events).enqueueRecoveredReport(audit.getValue());
        order.verify(repository).markReportEnqueued(key);
        verify(repository, never()).markReportAuditRecovered(key);
        assertThat(audit.getValue().eventId()).isEqualTo(decisionId);
        assertThat(audit.getValue().createdAt()).isEqualTo(decisionTime);
    }

    @Test
    void failedShardedEnqueueRetainsAlreadyRepairedWorkForRetryAfterRestart() {
        var key = key();
        var authority = authority(key, Map.of("outboxRoute", "sharded-v1", "recovered", "true"));
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(authority);
        doThrow(new IllegalStateException("outbox unavailable")).doNothing()
                .when(events).enqueueRecoveredReport(any());

        recovery.recover();

        verify(events).enqueueRecoveredReport(any());
        verify(repository, never()).markReportEnqueued(key);
        verify(repository, never()).removeReportWork(key);

        new ReportDecisionRecovery(repository, events, Optional.empty()).recover();

        var audit = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        var order = inOrder(repository, events);
        order.verify(events, times(2)).enqueueRecoveredReport(audit.capture());
        order.verify(repository).markReportEnqueued(key);
        assertThat(audit.getAllValues()).containsExactly(audit.getValue(), audit.getValue());
        assertThat(audit.getValue().eventId()).isEqualTo(decisionId);
        verify(repository, never()).replayReportProjection(any(), any());
        verify(events, never()).restoreReportAudit(any());
        verify(repository, never()).markReportAuditRecovered(key);
    }

    @Test
    void skipsUncommittedAndPreviouslyRepairedItemsAndRemovesOnlyFullyEnqueuedWork() {
        var missing = key();
        var pending = key();
        var repaired = key();
        var enqueued = key();
        when(repository.reportWorkPage((byte) 0, null, 25))
                .thenReturn(List.of(missing, pending, repaired, enqueued));
        when(repository.reportWorkAuthority(pending)).thenReturn(new ReportWorkAuthority(null, Map.of()));
        when(repository.reportWorkAuthority(repaired)).thenReturn(authority(repaired, Map.of("recovered", "true")));
        when(repository.reportWorkAuthority(enqueued)).thenReturn(authority(enqueued, Map.of("enqueued", "true")));

        recovery.recover();

        verify(repository).removeReportWork(enqueued);
        verify(repository, never()).removeReportWork(missing);
        verify(repository, never()).removeReportWork(pending);
        verify(repository, never()).removeReportWork(repaired);
        verify(repository, never()).replayReportProjection(any(), any());
        verify(repository, never()).markReportAuditRecovered(any());
        verify(events).hasLegacyReportReceipt(decisionId);
        verifyNoMoreInteractions(events);
    }

    @Test
    void confirmedLegacyReceiptAllowsCleanupWithoutEnqueueingAgain() {
        var key = key();
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(authority(key, Map.of("recovered", "true")));
        when(events.hasLegacyReportReceipt(decisionId)).thenReturn(true);

        recovery.recover();

        var order = inOrder(events, repository);
        order.verify(events).hasLegacyReportReceipt(decisionId);
        order.verify(repository).markReportEnqueued(key);
        verify(repository, never()).replayReportProjection(any(), any());
        verifyNoMoreInteractions(events);
    }

    @Test
    void disabledBrokerLeavesUnacknowledgedLegacyWorkIntact() {
        var key = key();
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(authority(key, Map.of("recovered", "true")));
        when(events.hasLegacyReportReceipt(decisionId)).thenReturn(false);

        recovery.recover();

        verify(events).hasLegacyReportReceipt(decisionId);
        verifyNoMoreInteractions(events);
        verify(repository, never()).markReportEnqueued(key);
        verify(repository, never()).removeReportWork(key);
    }

    @Test
    void legacyRecoveryRetriesTheSameIdentityAndCompletesOnlyAfterAcknowledgement() {
        var key = key();
        var authority = authority(key, Map.of("recovered", "true"));
        var publisher = mock(CassandraOutboxPublisher.class);
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(authority);
        when(publisher.publishLegacyReports(List.of(decisionId))).thenReturn(List.of(), List.of(decisionId));

        new ReportDecisionRecovery(repository, events, Optional.of(publisher)).recover();
        verify(repository, never()).markReportEnqueued(key);

        new ReportDecisionRecovery(repository, events, Optional.of(publisher)).recover();

        var order = inOrder(events, publisher, repository);
        var audit = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        order.verify(events).enqueueLegacyRecoveredReport(audit.capture());
        order.verify(publisher).publishLegacyReports(List.of(decisionId));
        order.verify(events).enqueueLegacyRecoveredReport(audit.capture());
        order.verify(publisher).publishLegacyReports(List.of(decisionId));
        order.verify(repository).markReportEnqueued(key);
        assertThat(audit.getAllValues()).containsExactly(audit.getValue(), audit.getValue());
        assertThat(audit.getValue().eventId()).isEqualTo(decisionId);
        assertThat(audit.getValue().createdAt()).isEqualTo(decisionTime);
        verify(events, never()).enqueueRecoveredReport(any());
        verify(events, never()).restoreReportAudit(any());
    }

    @Test
    void unknownRouteIsNotProbedAsLegacyOrEnqueuedAsSharded() {
        var key = key();
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(key));
        when(repository.reportWorkAuthority(key)).thenReturn(
                authority(key, Map.of("outboxRoute", "future-v2", "recovered", "true")));

        recovery.recover();

        verifyNoInteractions(events);
        verify(repository, never()).markReportEnqueued(key);
        verify(repository, never()).removeReportWork(key);
    }

    @Test
    void failureDoesNotMarkItemAndDoesNotStarveLaterItemsOrShards() {
        var failed = key();
        var succeeded = key();
        var failedAuthority = authority(failed, Map.of());
        var successfulAuthority = authority(succeeded, Map.of());
        when(repository.reportWorkPage((byte) 0, null, 25)).thenReturn(List.of(failed, succeeded));
        when(repository.reportWorkAuthority(failed)).thenReturn(failedAuthority);
        when(repository.reportWorkAuthority(succeeded)).thenReturn(successfulAuthority);
        doThrow(new IllegalStateException("audit unavailable")).doNothing().when(events).restoreReportAudit(any());
        for (byte shard = 1; shard < ModerationRepository.REPORT_WORK_SHARDS; shard++) {
            when(repository.reportWorkPage(shard, null, 25)).thenReturn(List.of());
        }

        recovery.recover();
        for (int shard = 1; shard <= ModerationRepository.REPORT_WORK_SHARDS; shard++) recovery.recover();

        verify(repository).replayReportProjection(failed, failedAuthority);
        verify(repository, never()).markReportAuditRecovered(failed);
        verify(repository, never()).removeReportWork(failed);
        verify(repository).markReportAuditRecovered(succeeded);
        verify(repository).reportWorkPage((byte) 1, null, 25);
        verify(repository).reportWorkPage((byte) 0, succeeded, 25);
    }

    private ReportWorkKey key() {
        return new ReportWorkKey((byte) 0, UUID.randomUUID(), "OPEN", UUID.randomUUID(),
                Uuids.startOf(Instant.parse("2025-12-31T20:00:00Z").toEpochMilli()));
    }

    private ReportWorkAuthority authority(ReportWorkKey key, Map<String, String> extra) {
        var intent = new HashMap<>(Map.of(
                "id", decisionId.toString(), "actorId", actor.toString(), "reason", "Checked evidence",
                "nextStatus", "RESOLVED", "assignedTo", actor.toString(), "resolutionCode", "REVIEWED",
                "resolvedAt", decisionTime.toString(), "projectionStamp", "1767225599999000"));
        intent.putAll(extra);
        return new ReportWorkAuthority(new ReportRow(key.reportId(), key.createdAt(), LocalDate.of(2025, 12, 31),
                "RESOLVED", key.reporterId(), "USER", targetUser, conversation, null, null,
                "SPAM", null, null, null, null), Map.copyOf(intent));
    }
}
