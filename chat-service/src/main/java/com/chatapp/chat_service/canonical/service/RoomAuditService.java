package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomEvent;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

@Service
public class RoomAuditService {

    private final CanonicalCqlStore store;
    private final ConversationAuthorizationService authorization;

    public RoomAuditService(CanonicalCqlStore store, ConversationAuthorizationService authorization) {
        this.store = store;
        this.authorization = authorization;
    }

    public CanonicalApiContracts.RoomAuditPage list(
            UUID actorId,
            UUID conversationId,
            String month,
            UUID beforeEventId,
            int requestedLimit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.ROOM_AUDIT_READ);
        String eventMonth = requireMonth(month);
        requireTimeUuid(beforeEventId);
        int limit = Math.max(1, Math.min(requestedLimit, 100));
        List<CanonicalRoomEvent> rows = store.listRoomEvents(
                conversationId, eventMonth, beforeEventId, limit + 1);
        boolean hasNext = rows.size() > limit;
        List<CanonicalRoomEvent> pageRows = hasNext ? rows.subList(0, limit) : rows;
        List<CanonicalApiContracts.RoomAuditEventView> content = pageRows.stream()
                .map(this::toView)
                .toList();
        UUID nextCursor = hasNext ? pageRows.get(pageRows.size() - 1).eventId() : null;
        return new CanonicalApiContracts.RoomAuditPage(content, nextCursor, hasNext);
    }

    private String requireMonth(String month) {
        if (month == null) {
            throw new BadRequestException("month must use YYYY-MM");
        }
        try {
            return YearMonth.parse(month).toString();
        } catch (DateTimeParseException exception) {
            throw new BadRequestException("month must use YYYY-MM");
        }
    }

    private void requireTimeUuid(UUID cursor) {
        if (cursor != null && cursor.version() != 1) {
            throw new BadRequestException("beforeEventId must be a timeuuid");
        }
    }

    private CanonicalApiContracts.RoomAuditEventView toView(CanonicalRoomEvent event) {
        return new CanonicalApiContracts.RoomAuditEventView(
                event.eventId(), event.eventType(), event.actorId(), event.targetUserId(),
                event.messageBucket(), event.messageId(), event.reasonCode(), event.metadata(), event.createdAt());
    }
}
