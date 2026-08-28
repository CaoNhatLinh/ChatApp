package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminConversationServiceTest {
    private final AdminConversationDirectoryRepository directory = mock(AdminConversationDirectoryRepository.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final AdminConversationService service = new AdminConversationService(directory, authorization, events);

    @Test
    void globalPolicyMutationRequiresRoomModerationAndRecordsAudit() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        var current = summary(conversationId, "OPEN", 0, false);
        var updated = summary(conversationId, "READ_ONLY", 30, false);
        when(directory.find(conversationId)).thenReturn(current);
        when(directory.updateChatPolicy(conversationId, "READ_ONLY", 30)).thenReturn(updated);

        service.updatePolicy(actorId, conversationId,
                new AdminConversationService.PolicyMutation("READ_ONLY", 30, "spam incident"));

        verify(authorization).require(actorId, AppPermission.ROOM_MODERATE);
        verify(events).record(eq(actorId), eq(conversationId), eq("ADMIN_CONVERSATION_CHAT_POLICY_UPDATE"),
                eq("conversation"), eq(conversationId.toString()), isNull(), eq("spam incident"), anyMap(), anyMap());
    }

    @Test
    void invalidGlobalPolicyIsRejectedBeforeWrite() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();

        assertThatThrownBy(() -> service.updatePolicy(actorId, conversationId,
                new AdminConversationService.PolicyMutation("UNKNOWN", 0, "bad")))
                .isInstanceOf(BadRequestException.class);
        verify(directory, never()).updateChatPolicy(any(), anyString(), anyInt());
    }

    @Test
    void invalidRoomDirectoryMonthIsRejected() {
        UUID actorId = UUID.randomUUID();

        assertThatThrownBy(() -> service.list(actorId, "2026/08", 50))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("month must use YYYY-MM format");
        verify(directory, never()).list(any(), anyInt());
    }

    @Test
    void dangerousGlobalMutationRequiresAnAuditReason() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();

        assertThatThrownBy(() -> service.updatePolicy(actorId, conversationId,
                new AdminConversationService.PolicyMutation("OPEN", 0, "  ")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("reason is required and must be at most 500 characters");
        assertThatThrownBy(() -> service.archive(actorId, conversationId, null, true))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("reason is required and must be at most 500 characters");
        verify(directory, never()).find(any());
    }

    private AdminConversationDirectoryRepository.AdminConversationSummary summary(
            UUID conversationId, String mode, int slowMode, boolean deleted) {
        Instant now = Instant.now();
        return new AdminConversationDirectoryRepository.AdminConversationSummary(
                conversationId, "GROUP", "PRIVATE", "INVITE_ONLY", "Room", null,
                UUID.randomUUID(), 2, mode, slowMode, deleted, now, now, List.of());
    }
}
