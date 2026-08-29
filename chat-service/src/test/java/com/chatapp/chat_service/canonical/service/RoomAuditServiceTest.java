package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.RoomAuditPage;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomEvent;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomAuditServiceTest {

    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    private final RoomAuditService service = new RoomAuditService(store, authorization);

    @Test
    void readsOneBoundedRoomMonthAndReturnsATimeUuidCursor() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID firstId = UUID.fromString("c8a4f8b0-65df-11f1-8000-000000000001");
        UUID secondId = UUID.fromString("c8a4f8b0-65df-11f1-8000-000000000002");
        CanonicalRoomEvent first = event(conversationId, firstId, "ROLE_UPDATED");
        CanonicalRoomEvent second = event(conversationId, secondId, "MEMBER_CHAT_POLICY_UPDATE");
        when(store.listRoomEvents(conversationId, "2026-08", null, 2))
                .thenReturn(List.of(first, second));

        RoomAuditPage page = service.list(actorId, conversationId, "2026-08", null, 1);

        assertThat(page.content()).singleElement().satisfies(item -> {
            assertThat(item.eventId()).isEqualTo(firstId);
            assertThat(item.eventType()).isEqualTo("ROLE_UPDATED");
        });
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(firstId);
        verify(authorization).requirePermission(
                conversationId, actorId, ConversationPermission.ROOM_AUDIT_READ);
    }

    @Test
    void rejectsInvalidMonthAndNonTimeUuidCursorBeforeQuerying() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();

        assertThatThrownBy(() -> service.list(actorId, conversationId, "2026-13", null, 50))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("month");
        assertThatThrownBy(() -> service.list(
                actorId, conversationId, "2026-08", UUID.randomUUID(), 50))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("timeuuid");
    }

    private CanonicalRoomEvent event(UUID conversationId, UUID eventId, String eventType) {
        return new CanonicalRoomEvent(
                conversationId, "2026-08", eventId, eventType, UUID.randomUUID(), UUID.randomUUID(),
                null, null, "moderation", Map.of("source", "room"), Instant.parse("2026-08-29T08:00:00Z"));
    }
}
