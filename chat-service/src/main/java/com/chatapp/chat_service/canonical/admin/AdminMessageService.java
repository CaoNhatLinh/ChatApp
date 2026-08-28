package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AdminMessageService {
    private static final Pattern MESSAGE_BUCKET = Pattern.compile("\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}");

    private final CanonicalCqlStore store;
    private final AppAuthorizationService authorization;
    private final CanonicalEventRecorder events;

    public AdminMessageService(
            CanonicalCqlStore store,
            AppAuthorizationService authorization,
            CanonicalEventRecorder events) {
        this.store = store;
        this.authorization = authorization;
        this.events = events;
    }

    public AdminMessageInspection inspect(
            UUID actorId,
            UUID conversationId,
            String bucket,
            UUID messageId,
            String reason) {
        authorization.require(actorId, AppPermission.AUDIT_READ);
        requireBucket(bucket);
        requireReason(reason);

        CanonicalMessage message = store.findMessage(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }

        List<CanonicalApiContracts.MessageRevisionView> revisions =
                store.listMessageRevisions(conversationId, bucket, messageId);
        events.record(
                actorId,
                conversationId,
                "ADMIN_MESSAGE_VIEW",
                "message",
                messageId.toString(),
                message.senderId(),
                reason.trim(),
                Map.of(),
                Map.of("messageBucket", bucket, "isDeleted", String.valueOf(Boolean.TRUE.equals(message.isDeleted()))));
        return new AdminMessageInspection(message, revisions);
    }

    private static void requireBucket(String bucket) {
        if (bucket == null || !MESSAGE_BUCKET.matcher(bucket.trim()).matches()) {
            throw new BadRequestException("message bucket must use YYYY-MM-DD-HH:NN format");
        }
    }

    private static void requireReason(String reason) {
        String normalized = reason == null ? "" : reason.trim();
        if (normalized.isBlank() || normalized.length() > 500) {
            throw new BadRequestException("reason is required and must be at most 500 characters");
        }
    }

    public record AdminMessageInspection(
            CanonicalMessage message,
            List<CanonicalApiContracts.MessageRevisionView> revisions) {
    }
}
