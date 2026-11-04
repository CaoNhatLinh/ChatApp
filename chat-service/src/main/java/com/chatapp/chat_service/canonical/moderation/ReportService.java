package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

@Service
public class ReportService {
    private static final Pattern MESSAGE_BUCKET = Pattern.compile("[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}:(0[0-9]|1[0-5])");

    private final ModerationRepository repository;
    private final CanonicalCqlStore store;
    private final MessageRepository messages;
    private final UserRepository users;
    private final CanonicalEventRecorder events;
    private final ConversationAuthorizationService authorization;

    public ReportService(
            ModerationRepository repository,
            CanonicalCqlStore store,
            MessageRepository messages,
            UserRepository users,
            CanonicalEventRecorder events,
            ConversationAuthorizationService authorization) {
        this.repository = repository;
        this.store = store;
        this.messages = messages;
        this.users = users;
        this.events = events;
        this.authorization = authorization;
    }

    public ModerationRepository.ReportRow create(UUID reporterId, CreateReportRequest request) {
        return create(reporterId, request, null);
    }

    public ModerationRepository.ReportRow create(UUID reporterId, CreateReportRequest request, UUID clientReportId) {
        if (request == null) {
            throw new BadRequestException("report payload is required");
        }
        String targetType = request.targetType() == null ? "" : request.targetType().trim().toUpperCase(Locale.ROOT);
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
        UUID messageId = request.messageId();
        String bucket = request.messageBucket() == null ? null : request.messageBucket().trim();
        String normalizedDescription = description.isBlank() ? null : description;
        String fingerprint = clientReportId == null ? null : fingerprint(targetType, targetUserId, conversationId,
                bucket, messageId, reasonCode, normalizedDescription);
        if (clientReportId != null) {
            // Read preparation first: cleanup only happens after the exact command is durable.
            var preparation = repository.findCreatePreparation(reporterId, clientReportId);
            if (preparation != null && fingerprint.equals(preparation.command().fingerprint())) {
                return resume(preparation, fingerprint);
            }
            var existing = repository.findCreateCommand(reporterId, clientReportId);
            if (existing != null) return complete(reporterId, existing, fingerprint, targetType,
                    conversationId, bucket, messageId, reasonCode, normalizedDescription);
            if (preparation != null) throw new ConflictException("Idempotency-Key was already used for a different report");
        }
        switch (targetType) {
            case "USER" -> {
                if (targetUserId == null || conversationId != null || bucket != null || messageId != null) {
                    throw new BadRequestException("user reports require only a targetUserId as their target");
                }
                if (reporterId.equals(targetUserId)) {
                    throw new ConflictException("cannot report your own account");
                }
                requireUser(targetUserId);
            }
            case "CONVERSATION" -> {
                if (conversationId == null || targetUserId != null || bucket != null || messageId != null) {
                    throw new BadRequestException("conversation reports require only a conversationId as their target");
                }
                requireConversationAccess(reporterId, conversationId);
            }
            case "MESSAGE" -> {
                if (conversationId == null || targetUserId != null || messageId == null || messageId.version() != 1
                        || bucket == null || !MESSAGE_BUCKET.matcher(bucket).matches()) {
                    throw new BadRequestException("message reports require conversationId, a valid messageBucket and a timeuuid messageId");
                }
                requireConversationAccess(reporterId, conversationId);
                var message = messages.find(conversationId, bucket, messageId);
                if (message == null || Boolean.TRUE.equals(message.isDeleted())) {
                    throw new NotFoundException("message not found");
                }
                targetUserId = message.senderId();
                if (reporterId.equals(targetUserId)) {
                    throw new ConflictException("cannot report your own message");
                }
            }
            default -> throw new BadRequestException("targetType must be USER, MESSAGE, or CONVERSATION");
        }
        if (clientReportId != null) {
            var preparation = repository.prepareCreate(reporterId, clientReportId, fingerprint, targetUserId,
                    targetType, conversationId, bucket, messageId, reasonCode, normalizedDescription);
            return resume(preparation, fingerprint);
        }
        ModerationRepository.ReportRow report = repository.createReport(
                reporterId, targetType, targetUserId, conversationId, bucket, messageId,
                reasonCode, normalizedDescription);
        events.record(reporterId, conversationId, "REPORT_CREATED", "report", report.reportId().toString(),
                targetUserId, reasonCode, Map.of(), Map.of("status", "OPEN"),
                Map.of("targetType", targetType));
        return report;
    }

    private ModerationRepository.ReportRow resume(ModerationRepository.CreatePreparation preparation, String fingerprint) {
        if (fingerprint.equals(preparation.command().fingerprint())) {
            var report = repository.resumePreparedCreate(preparation);
            if (report != null) return report;
        }
        throw new ConflictException("Idempotency-Key was already used for a different report");
    }

    private ModerationRepository.ReportRow complete(UUID reporterId, ModerationRepository.CreateCommand command,
            String fingerprint, String targetType, UUID conversationId, String bucket, UUID messageId,
            String reasonCode, String description) {
        if (!fingerprint.equals(command.fingerprint())) {
            throw new ConflictException("Idempotency-Key was already used for a different report");
        }
        return repository.completeCreateCommand(reporterId, command, targetType, conversationId,
                bucket, messageId, reasonCode, description);
    }

    private static String fingerprint(Object... fields) {
        var canonical = new StringBuilder();
        for (Object field : fields) {
            String value = Objects.toString(field, null);
            if (value == null) canonical.append("-1:");
            else canonical.append(value.length()).append(':').append(value);
        }
        try {
            var hash = MessageDigest.getInstance("SHA-256");
            for (int index = 0; index < canonical.length(); index++) {
                char codeUnit = canonical.charAt(index);
                hash.update((byte) (codeUnit >>> 8));
                hash.update((byte) codeUnit);
            }
            return HexFormat.of().formatHex(hash.digest());
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    public List<ModerationRepository.ReportRow> listMine(UUID reporterId, int limit) {
        return repository.listReportsByReporter(reporterId, limit);
    }

    private void requireUser(UUID userId) {
        if (userId == null || users.findById(userId) == null) {
            throw new NotFoundException("user not found");
        }
    }

    private void requireConversationAccess(UUID reporterId, UUID conversationId) {
        authorization.requireMember(conversationId, reporterId);
        if (store.findConversation(conversationId) == null) {
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
