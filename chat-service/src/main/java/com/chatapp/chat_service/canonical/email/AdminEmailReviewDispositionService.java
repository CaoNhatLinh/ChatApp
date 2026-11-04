package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class AdminEmailReviewDispositionService {
    private final AppAuthorizationService authorization;
    private final EmailReviewDispositionRepository reviews;

    public AdminEmailReviewDispositionService(AppAuthorizationService authorization, EmailReviewDispositionRepository reviews) {
        this.authorization = authorization;
        this.reviews = reviews;
    }

    public Result close(UUID actor, UUID userId, String month, UUID notificationId, Request request) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        EmailHistoryService.validateMonth(month);
        if (notificationId.version() != 1) throw new BadRequestException("notificationId must be a timeuuid");
        if (request == null || request.commandId() == null || request.commandId().version() != 4) {
            throw new BadRequestException("commandId must be a version 4 UUID");
        }
        String reason = request.reason() == null ? "" : request.reason().strip();
        if (reason.isBlank() || reason.length() > 300) throw new BadRequestException("reason must contain 1 to 300 characters");

        var key = new EmailDeliveryRepository.Key(userId, month, notificationId);
        var receipt = new EmailReviewDispositionRepository.Receipt(
                request.commandId(), actor, reason, Instant.ofEpochMilli(System.currentTimeMillis()));
        var state = reviews.find(key);
        if (state == null) throw new NotFoundException("Email delivery not found");
        if (state.receipt() != null) return replay(state.receipt(), receipt);
        if (!"REVIEW_REQUIRED".equals(state.status())) throw changed();
        if (reviews.close(key, receipt)) return new Result(receipt.reviewedAt());

        var current = reviews.find(key);
        return replay(current == null ? null : current.receipt(), receipt);
    }

    private static Result replay(EmailReviewDispositionRepository.Receipt saved, EmailReviewDispositionRepository.Receipt request) {
        if (saved != null && saved.commandId().equals(request.commandId())
                && saved.actorId().equals(request.actorId()) && saved.reason().equals(request.reason())) {
            return new Result(saved.reviewedAt());
        }
        throw changed();
    }

    private static ConflictException changed() {
        return new ConflictException("Email review has changed. Reload the delivery.");
    }

    public record Request(UUID commandId, String reason) {}
    public record Result(Instant reviewedAt) {}
}
