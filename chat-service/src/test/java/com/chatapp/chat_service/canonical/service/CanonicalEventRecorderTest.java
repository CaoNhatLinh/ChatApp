package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.analytics.AnalyticsRepository;
import com.chatapp.chat_service.canonical.audit.AuditRepository;
import com.chatapp.chat_service.canonical.messaging.OutboxRepository;
import com.chatapp.chat_service.canonical.messaging.ReportOutboxRoute;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoMoreInteractions;

class CanonicalEventRecorderTest {

    @Test
    void legacyReceiptUsesOriginalUtcHourWithoutReenqueue() {
        var outbox = mock(OutboxRepository.class);
        var recorder = new CanonicalEventRecorder(mock(AuditRepository.class), mock(AnalyticsRepository.class),
                outbox, new ObjectMapper());
        UUID decision = Uuids.startOf(Instant.parse("2025-12-31T23:59:59.999Z").toEpochMilli());
        when(outbox.hasReportReceipt("2025-12-31-23", decision)).thenReturn(true);
        assertThat(recorder.hasLegacyReportReceipt(decision)).isTrue();
        verify(outbox).hasReportReceipt("2025-12-31-23", decision);
        verifyNoMoreInteractions(outbox);
    }

    @Test
    void persistedDecisionIdControlsAuditAndOutboxPartitionRatherThanWallClock() {
        var audit = mock(AuditRepository.class);
        var outbox = mock(OutboxRepository.class);
        var recorder = new CanonicalEventRecorder(audit, mock(AnalyticsRepository.class),
                outbox, new ObjectMapper().findAndRegisterModules());
        Instant committed = Instant.parse("2025-12-31T23:59:59.999Z");
        UUID decisionId = Uuids.startOf(committed.toEpochMilli());
        UUID reportId = UUID.randomUUID();

        assertThat(recorder.recordWithIdentity(decisionId, UUID.randomUUID(), UUID.randomUUID(),
                "REPORT_STATUS_UPDATE", "report", reportId.toString(), null,
                "Reviewed evidence", Map.of("status", "OPEN"), Map.of("status", "RESOLVED")))
                .isEqualTo(decisionId);

        var auditEvent = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        verify(audit).saveAuditEvent(auditEvent.capture());
        verify(audit).saveRoomEvent(auditEvent.getValue());
        assertThat(auditEvent.getValue().eventId()).isEqualTo(decisionId);
        assertThat(auditEvent.getValue().eventMonth()).isEqualTo("2025-12");
        assertThat(auditEvent.getValue().createdAt()).isEqualTo(committed);
        var event = ArgumentCaptor.forClass(OutboxRepository.OutboxEvent.class);
        recorder.enqueueRecoveredReport(auditEvent.getValue());
        verify(outbox, times(2)).enqueue(event.capture());
        assertThat(event.getAllValues().get(0)).isEqualTo(event.getAllValues().get(1));
        assertThat(event.getValue().eventId()).isEqualTo(decisionId);
        assertThat(event.getValue().eventPartition()).isEqualTo(ReportOutboxRoute.partition(reportId));
        assertThat(event.getValue().createdAt()).isEqualTo(committed);

        recorder.enqueueLegacyRecoveredReport(auditEvent.getValue());
        verify(outbox).enqueue(new OutboxRepository.OutboxEvent("2025-12-31-23", decisionId, "report",
                reportId.toString(), "REPORT_STATUS_UPDATE", event.getValue().payloadJson(), committed, null, 0));
    }

    @Test
    void recordsRoomAuditResourceAuditAndOutboxWithOneTimeUuid() {
        AuditRepository audit = mock(AuditRepository.class);
        AnalyticsRepository analytics = mock(AnalyticsRepository.class);
        OutboxRepository outbox = mock(OutboxRepository.class);
        CanonicalEventRecorder recorder = new CanonicalEventRecorder(
                audit, analytics, outbox, new ObjectMapper().findAndRegisterModules());
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();

        UUID eventId = recorder.record(
                actorId, conversationId, "ROLE_CREATED", "role", "role-1", null,
                "USER_REQUEST", Map.of(), Map.of("color", "#3366FF"));

        assertThat(eventId.version()).isEqualTo(1);
        ArgumentCaptor<CanonicalRoomAuditEvent> event = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        verify(audit).saveRoomEvent(event.capture());
        verify(analytics).record(event.getValue());
        verify(audit).saveAuditEvent(event.getValue());
        verify(outbox).enqueue(any());
        assertThat(event.getValue().eventId()).isEqualTo(eventId);
        assertThat(event.getValue().afterState()).containsEntry("color", "#3366FF");
    }
}
