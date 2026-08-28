package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
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
        CanonicalCqlStore store = mock(CanonicalCqlStore.class);
        CanonicalEventRecorder recorder = new CanonicalEventRecorder(store, new ObjectMapper().findAndRegisterModules());
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();

        UUID eventId = recorder.record(
                actorId, conversationId, "ROLE_CREATED", "role", "role-1", null,
                "USER_REQUEST", Map.of(), Map.of("color", "#3366FF"));

        assertThat(eventId.version()).isEqualTo(1);
        ArgumentCaptor<CanonicalRoomAuditEvent> event = ArgumentCaptor.forClass(CanonicalRoomAuditEvent.class);
        verify(store).saveRoomEvent(event.capture());
        verify(store).saveAuditEvent(event.getValue());
        verify(store).saveOutboxEvent(anyString(), any(), anyString(), anyString(), anyString(), anyString(), any());
        assertThat(event.getValue().eventId()).isEqualTo(eventId);
        assertThat(event.getValue().afterState()).containsEntry("color", "#3366FF");
    }
}
