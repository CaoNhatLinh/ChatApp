package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@Service
public class AdminConversationService {
    private final AdminConversationDirectoryRepository directory;
    private final AppAuthorizationService authorization;
    private final CanonicalEventRecorder events;

    public AdminConversationService(
            AdminConversationDirectoryRepository directory,
            AppAuthorizationService authorization,
            CanonicalEventRecorder events) {
        this.directory = directory;
        this.authorization = authorization;
        this.events = events;
    }

    public java.util.List<AdminConversationDirectoryRepository.AdminConversationSummary> list(
            UUID actorId, String month, int limit) {
        authorization.require(actorId, AppPermission.ROOM_READ);
        return directory.list(normalizeMonth(month), limit);
    }

    public AdminConversationDirectoryRepository.AdminConversationSummary detail(UUID actorId, UUID conversationId, int limit) {
        authorization.require(actorId, AppPermission.ROOM_READ);
        return directory.detail(conversationId, limit);
    }

    public AdminConversationDirectoryRepository.AdminConversationSummary updatePolicy(
            UUID actorId, UUID conversationId, PolicyMutation request) {
        authorization.require(actorId, AppPermission.ROOM_MODERATE);
        if (request == null) {
            throw new BadRequestException("policy mutation is required");
        }
        requireReason(request.reason());
        if (request.chatMode() == null || request.chatMode().isBlank()) {
            throw new BadRequestException("chatMode is required");
        }
        if (request.slowModeSeconds() == null) {
            throw new BadRequestException("slowModeSeconds is required");
        }
        String chatMode = request.chatMode().trim().toUpperCase();
        if (!java.util.Set.of("OPEN", "READ_ONLY", "MANAGERS_ONLY").contains(chatMode)) {
            throw new BadRequestException("chatMode must be OPEN, READ_ONLY, or MANAGERS_ONLY");
        }
        int slowMode = request.slowModeSeconds();
        if (slowMode < 0 || slowMode > 86_400) {
            throw new BadRequestException("slowModeSeconds must be between 0 and 86400");
        }
        var current = directory.find(conversationId);
        var updated = directory.updateChatPolicy(conversationId, chatMode, slowMode);
        events.record(actorId, conversationId, "ADMIN_CONVERSATION_CHAT_POLICY_UPDATE", "conversation",
                conversationId.toString(), null, request == null ? null : request.reason(),
                Map.of("chatMode", String.valueOf(current.chatMode()), "slowModeSeconds", String.valueOf(current.slowModeSeconds())),
                Map.of("chatMode", chatMode, "slowModeSeconds", String.valueOf(slowMode)));
        return updated;
    }

    public AdminConversationDirectoryRepository.AdminConversationSummary archive(
            UUID actorId, UUID conversationId, String reason, boolean archived) {
        authorization.require(actorId, AppPermission.ROOM_MODERATE);
        requireReason(reason);
        var current = directory.find(conversationId);
        var updated = directory.setArchived(conversationId, archived);
        events.record(actorId, conversationId, archived ? "ADMIN_CONVERSATION_ARCHIVE" : "ADMIN_CONVERSATION_RESTORE",
                "conversation", conversationId.toString(), null, reason,
                Map.of("isDeleted", String.valueOf(Boolean.TRUE.equals(current.deleted()))),
                Map.of("isDeleted", String.valueOf(archived)));
        return updated;
    }

    private static void requireReason(String reason) {
        String normalized = reason == null ? "" : reason.trim();
        if (normalized.isBlank() || normalized.length() > 500) {
            throw new BadRequestException("reason is required and must be at most 500 characters");
        }
    }

    private static String normalizeMonth(String month) {
        if (month == null || month.isBlank()) return null;
        String normalized = month.trim();
        try {
            return YearMonth.parse(normalized).toString();
        } catch (DateTimeParseException exception) {
            throw new BadRequestException("month must use YYYY-MM format");
        }
    }

    public record PolicyMutation(String chatMode, Integer slowModeSeconds, String reason) {
    }
}
