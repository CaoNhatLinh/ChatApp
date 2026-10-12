package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.analytics.AnalyticsRepository;
import com.chatapp.chat_service.canonical.audit.AuditRepository;
import com.chatapp.chat_service.canonical.messaging.OutboxRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CanonicalEventRecorderTest {

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
