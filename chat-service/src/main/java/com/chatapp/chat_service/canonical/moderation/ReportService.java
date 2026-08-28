package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ReportService {
    private static final Set<String> TARGET_TYPES = Set.of("USER", "MESSAGE", "CONVERSATION");
    private static final java.util.regex.Pattern MESSAGE_BUCKET =
            java.util.regex.Pattern.compile("^\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}$");

    private final ModerationRepository repository;
    private final CanonicalCqlStore store;
    private final CanonicalEventRecorder events;

    public ReportService(ModerationRepository repository, CanonicalCqlStore store, CanonicalEventRecorder events) {
        this.repository = repository;
        this.store = store;
        this.events = events;
    }

    public ModerationRepository.ReportRow create(UUID reporterId, CreateReportRequest request) {
        if (request == null) {
            throw new BadRequestException("report payload is required");
        }
        String targetType = request == null || request.targetType() == null
                ? "" : request.targetType().trim().toUpperCase();
        if (!TARGET_TYPES.contains(targetType)) {
            throw new BadRequestException("targetType must be USER, MESSAGE, or CONVERSATION");
        }
        String reasonCode = request.reasonCode() == null ? "" : request.reasonCode().trim();
        if (reasonCode.isBlank() || reasonCode.length() > 80) {
            throw new BadRequestException("reasonCode is required and must be at most 80 characters");
        }
        String description = request.description() == null ? "" : request.description().trim();
        if (description.length() > 2_000) {
            throw new BadRequestException("description must be at most 2000 characters");
        }
        UUID targetUserId = request.targetUserId();
        UUID conversationId = request.conversationId();
        if ("USER".equals(targetType)) {
            requireUser(targetUserId);
            if (reporterId.equals(targetUserId)) {
                throw new ConflictException("cannot report your own account");
            }
        } else if ("CONVERSATION".equals(targetType)) {
            requireConversation(conversationId);
        } else {
            if (request.messageId() == null || request.messageBucket() == null
                    || !MESSAGE_BUCKET.matcher(request.messageBucket().trim()).matches()) {
                throw new BadRequestException("message reports require a valid messageBucket and messageId");
            }
            requireConversation(conversationId);
            if (store.findMessage(conversationId, request.messageBucket().trim(), request.messageId()) == null) {
                throw new NotFoundException("message not found");
            }
        }
        ModerationRepository.ReportRow report = repository.createReport(
                reporterId, targetType, targetUserId, conversationId,
                request.messageBucket() == null ? null : request.messageBucket().trim(), request.messageId(),
                reasonCode, description.isBlank() ? null : description);
        events.record(reporterId, conversationId, "REPORT_CREATED", "report", report.reportId().toString(),
                targetUserId, reasonCode, Map.of(), Map.of("status", "OPEN"),
                Map.of("targetType", targetType));
        return report;
    }

    public List<ModerationRepository.ReportRow> listMine(UUID reporterId, int limit) {
        return repository.listReportsByReporter(reporterId, limit);
    }

    private void requireUser(UUID userId) {
        if (userId == null || store.findUserById(userId) == null) {
            throw new NotFoundException("user not found");
        }
    }

    private void requireConversation(UUID conversationId) {
        if (conversationId == null || store.findConversation(conversationId) == null) {
            throw new NotFoundException("conversation not found");
        }
    }

    public record CreateReportRequest(
            String targetType,
            UUID targetUserId,
            UUID conversationId,
            String messageBucket,
            UUID messageId,
            String reasonCode,
            String description) {
    }
}
