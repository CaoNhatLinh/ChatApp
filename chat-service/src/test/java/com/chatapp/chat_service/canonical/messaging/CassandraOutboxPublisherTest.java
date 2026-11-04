package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.messaging.OutboxRepository.OutboxEvent;
import com.chatapp.chat_service.canonical.messaging.OutboxRepository.ReportPendingPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraOutboxPublisherTest {
    @Mock OutboxRepository outbox;
    @Mock DomainEventPublisher eventPublisher;

    @BeforeEach
    void noReportWorkByDefault() {
        lenient().when(outbox.findReportPending(anyString(), any(), anyInt()))
                .thenReturn(new ReportPendingPage(List.of(), null));
    }

    @Test
    void recoversExactOldLegacyKeysAndDoesNotReportRejectedOrAlreadyAcknowledgedEvents() {
        UUID acceptedId = UUID.randomUUID();
        UUID rejectedId = UUID.randomUUID();
        UUID acknowledgedId = UUID.randomUUID();
        Instant old = Instant.parse("2025-12-31T23:59:59.999Z");
        var accepted = new OutboxEvent("2025-12-31-23", acceptedId, "report", "report-a", "REPORT_STATUS_UPDATE", "{}", old, null, 3);
        var rejected = new OutboxEvent("2025-12-31-23", rejectedId, "report", "report-b", "REPORT_STATUS_UPDATE", "{}", old, null, 0);
        when(outbox.findLegacyReportPending(acceptedId)).thenReturn(accepted);
        when(outbox.findLegacyReportPending(rejectedId)).thenReturn(rejected);
        when(eventPublisher.publishBatch(any())).thenReturn(List.of(true, false));
        var publisher = new CassandraOutboxPublisher(outbox, eventPublisher, 10, 1);

        org.assertj.core.api.Assertions.assertThat(publisher.publishLegacyReports(List.of(acceptedId, rejectedId, acknowledgedId)))
                .containsExactly(acceptedId);

        verify(outbox).findLegacyReportPending(acknowledgedId);
        verify(outbox).recordPublishAttempt(eq(accepted), any(Instant.class));
        verify(outbox).recordPublishAttempt(rejected, null);
        verify(outbox, never()).findPending(anyString(), anyInt());
    }

    @Test
    void marksPublishedOnlyAfterTheTransportAcknowledgesTheEvent() {
        OutboxEvent event = new OutboxEvent(
                "2026-07-22-01", UUID.randomUUID(), "message", "message-1",
                "MESSAGE_SEND", "{\"ok\":true}", Instant.now(), null, 0);
        when(outbox.findPending(anyString(), anyInt()))
                .thenReturn(List.of(event))
                .thenReturn(List.of());
        when(eventPublisher.publishBatch(any())).thenReturn(List.of(true));
        CassandraOutboxPublisher publisher = new CassandraOutboxPublisher(
                outbox, eventPublisher, 10, 2);

        publisher.publishPending();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DomainEvent>> eventCaptor = ArgumentCaptor.forClass(List.class);
        verify(eventPublisher).publishBatch(eventCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(eventCaptor.getValue()).singleElement()
                .extracting(DomainEvent::aggregateId).isEqualTo("message-1");
        verify(outbox).recordPublishAttempt(any(OutboxEvent.class), any(Instant.class));
    }

    @Test
    void keepsTheEventPendingWhenTheTransportRejectsIt() {
        OutboxEvent event = new OutboxEvent(
                "2026-07-22-01", UUID.randomUUID(), "message", "message-1",
                "MESSAGE_SEND", "{\"ok\":true}", Instant.now(), null, 2);
        when(outbox.findPending(anyString(), anyInt()))
                .thenReturn(List.of(event))
                .thenReturn(List.of());
        when(eventPublisher.publishBatch(any())).thenReturn(List.of(false));
        CassandraOutboxPublisher publisher = new CassandraOutboxPublisher(
                outbox, eventPublisher, 10, 2);

        publisher.publishPending();

        verify(outbox).recordPublishAttempt(event, null);
    }

    @Test
    void publishesOldReportsAndStillScansTheOriginalHourlyOutbox() {
        OutboxEvent oldReport = new OutboxEvent(
                "report-decisions-0", UUID.randomUUID(), "report", "report-1",
                "REPORT_STATUS_UPDATE", "{\"status\":\"RESOLVED\"}", Instant.parse("2024-01-01T00:00:00Z"), null, 0);
        OutboxEvent hourly = new OutboxEvent(
                "hourly", UUID.randomUUID(), "message", "message-1",
                "MESSAGE_SEND", "{\"ok\":true}", Instant.now(), null, 0);
        when(outbox.findReportPending(eq("report-decisions-0"), isNull(), anyInt()))
                .thenReturn(new ReportPendingPage(List.of(oldReport), oldReport.eventId()));
        when(outbox.findPending(anyString(), anyInt())).thenReturn(List.of(hourly));
        when(eventPublisher.publishBatch(any())).thenAnswer(invocation ->
                ((List<?>) invocation.getArgument(0)).stream().map(ignored -> true).toList());

        new CassandraOutboxPublisher(outbox, eventPublisher, 10, 1).publishPending();

        verify(outbox).recordPublishAttempt(eq(oldReport), any(Instant.class));
        verify(outbox).recordPublishAttempt(eq(hourly), any(Instant.class));
        verify(outbox).findPending(matches("\\d{4}-\\d{2}-\\d{2}-\\d{2}"), anyInt());
    }

    @Test
    void rotatesShardsAndAdvancesPastARejectedReportBeforeWrappingItsCursor() {
        OutboxEvent rejected = new OutboxEvent(
                "report-decisions-0", UUID.randomUUID(), "report", "report-rejected",
                "REPORT_STATUS_UPDATE", "{}", Instant.parse("2024-01-01T00:00:00Z"), null, 0);
        OutboxEvent later = new OutboxEvent(
                "report-decisions-0", UUID.randomUUID(), "report", "report-later",
                "REPORT_STATUS_UPDATE", "{}", Instant.parse("2024-01-01T01:00:00Z"), null, 0);
        when(outbox.findReportPending(eq("report-decisions-0"), isNull(), anyInt()))
                .thenReturn(new ReportPendingPage(List.of(rejected), rejected.eventId()))
                .thenReturn(new ReportPendingPage(List.of(), null));
        when(outbox.findReportPending(eq("report-decisions-0"), eq(rejected.eventId()), anyInt()))
                .thenReturn(new ReportPendingPage(List.of(later), null));
        when(eventPublisher.publishBatch(any())).thenReturn(List.of(false), List.of(true));
        var publisher = new CassandraOutboxPublisher(outbox, eventPublisher, 10, 1);

        for (int tick = 0; tick < 33; tick++) publisher.publishPending();

        var order = org.mockito.Mockito.inOrder(outbox);
        order.verify(outbox).findReportPending(eq("report-decisions-0"), isNull(), anyInt());
        order.verify(outbox).recordPublishAttempt(rejected, null);
        order.verify(outbox).findReportPending(eq("report-decisions-1"), isNull(), anyInt());
        order.verify(outbox).findReportPending(eq("report-decisions-15"), isNull(), anyInt());
        order.verify(outbox).findReportPending(eq("report-decisions-0"), eq(rejected.eventId()), anyInt());
        order.verify(outbox).recordPublishAttempt(eq(later), any(Instant.class));
        order.verify(outbox).findReportPending(eq("report-decisions-0"), isNull(), anyInt());
    }
}
