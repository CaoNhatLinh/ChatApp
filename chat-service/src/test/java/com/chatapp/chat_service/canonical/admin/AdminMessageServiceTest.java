package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class AdminMessageServiceTest {
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final AdminMessageService service = new AdminMessageService(store, authorization, events);

    @Test
    void inspectionRequiresAuditReadAndRecordsReasonedAccess() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        String bucket = "2026-08-29-14:03";
        var message = new CqlCanonicalRecords.CanonicalMessage(
                conversationId, bucket, messageId, UUID.randomUUID(), "TEXT", "hello", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null,
                false, false, false, Instant.now(), UUID.randomUUID());
        when(store.findMessage(conversationId, bucket, messageId)).thenReturn(message);
        when(store.listMessageRevisions(conversationId, bucket, messageId)).thenReturn(List.of());

        var result = service.inspect(actorId, conversationId, bucket, messageId, "trust and safety review");

        assertThat(result.message()).isSameAs(message);
        assertThat(result.revisions()).isEmpty();
        verify(authorization).require(actorId, AppPermission.AUDIT_READ);
        verify(events).record(eq(actorId), eq(conversationId), eq("ADMIN_MESSAGE_VIEW"),
                eq("message"), eq(messageId.toString()), eq(message.senderId()),
                eq("trust and safety review"), anyMap(), anyMap());
    }

    @Test
    void invalidBucketOrMissingReasonIsRejectedBeforeStoreRead() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();

        assertThatThrownBy(() -> service.inspect(actorId, conversationId, "2026/08", messageId, "review"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.inspect(actorId, conversationId, "2026-08-29-14:03", messageId, "  "))
                .isInstanceOf(BadRequestException.class);
        verify(store, never()).findMessage(any(), anyString(), any());
    }
}
