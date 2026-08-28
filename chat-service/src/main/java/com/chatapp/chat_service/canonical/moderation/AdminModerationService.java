package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminModerationService {
    private static final Set<String> REPORT_STATUSES = Set.of("OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED");
    private static final Set<String> SANCTION_SCOPES = Set.of("APP", "CONVERSATION");
    private static final Set<String> SANCTION_TYPES = Set.of("BAN", "MUTE", "SUSPEND", "WARNING");

    private final ModerationRepository repository;
    private final CanonicalCqlStore store;
    private final AppAuthorizationService authorization;
    private final CanonicalEventRecorder events;

    public AdminModerationService(
            ModerationRepository repository,
            CanonicalCqlStore store,
            AppAuthorizationService authorization,
            CanonicalEventRecorder events) {
        this.repository = repository;
        this.store = store;
        this.authorization = authorization;
        this.events = events;
    }

    public List<ModerationRepository.ReportRow> listReports(UUID actorId, String status, String day, int limit) {
        authorization.require(actorId, AppPermission.REPORT_MANAGE);
        String normalizedStatus = normalize(status, REPORT_STATUSES, "status");
        LocalDate reportDay = parseDay(day);
        return repository.listReports(normalizedStatus, reportDay, limit);
    }

    public ModerationRepository.ReportRow resolveReport(
            UUID actorId, UUID reportId, ResolveReportRequest request) {
        authorization.require(actorId, AppPermission.REPORT_MANAGE);
        if (request == null || request.currentStatus() == null || request.reportDay() == null
                || request.createdAtKey() == null) {
            throw new BadRequestException("currentStatus, reportDay and createdAtKey are required");
        }
        String currentStatus = normalize(request.currentStatus(), REPORT_STATUSES, "currentStatus");
        String nextStatus = normalize(request.nextStatus(), REPORT_STATUSES, "nextStatus");
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isBlank() || reason.length() > 500) {
            throw new BadRequestException("reason is required and must be at most 500 characters");
        }
        if (currentStatus.equals(nextStatus)) {
            throw new ConflictException("report is already in the requested status");
        }
        if (("RESOLVED".equals(nextStatus) || "DISMISSED".equals(nextStatus))
                && (request.resolutionCode() == null || request.resolutionCode().isBlank())) {
            throw new BadRequestException("resolutionCode is required for a terminal report status");
        }
        ModerationRepository.ReportRow current = repository.findReport(currentStatus, request.reportDay(), reportId);
        if (current == null || !current.createdAtKey().equals(request.createdAtKey())) {
            throw new NotFoundException("report not found in the supplied status partition");
        }
        Instant resolvedAt = "RESOLVED".equals(nextStatus) || "DISMISSED".equals(nextStatus) ? Instant.now() : null;
        UUID assignedTo = request.assignedTo() == null ? actorId : request.assignedTo();
        ModerationRepository.ReportRow updated = repository.transitionReport(
                current, nextStatus, assignedTo, resolvedAt, request.resolutionCode());
        events.record(actorId, current.conversationId(), "REPORT_STATUS_UPDATE", "report", reportId.toString(),
                current.targetUserId(), reason,
                Map.of("status", current.status()), Map.of("status", nextStatus, "resolutionCode",
                        request.resolutionCode() == null ? "" : request.resolutionCode()));
        return updated;
    }

    public List<ModerationRepository.SanctionRow> listSanctions(UUID actorId, UUID userId, int limit) {
        authorization.require(actorId, AppPermission.REPORT_MANAGE);
        if (store.findUserById(userId) == null) throw new NotFoundException("user not found");
        return repository.listSanctions(userId, limit);
    }

    public ModerationRepository.SanctionRow imposeSanction(UUID actorId, SanctionRequest request) {
        authorization.require(actorId, AppPermission.REPORT_MANAGE);
        if (request == null || request.userId() == null) throw new BadRequestException("userId is required");
        if (actorId.equals(request.userId())) throw new ConflictException("cannot sanction your own account");
        if (store.findUserById(request.userId()) == null) throw new NotFoundException("user not found");
        String scope = normalize(request.scope(), SANCTION_SCOPES, "scope");
        String type = normalize(request.sanctionType(), SANCTION_TYPES, "sanctionType");
        if ("APP".equals(scope) && request.conversationId() != null) {
            throw new BadRequestException("APP sanctions cannot include conversationId");
        }
        if ("CONVERSATION".equals(scope) && (request.conversationId() == null
                || store.findConversation(request.conversationId()) == null)) {
            throw new NotFoundException("conversation not found");
        }
        if ("CONVERSATION".equals(scope) && store.findConversationMember(request.conversationId(), request.userId()) == null) {
            throw new NotFoundException("conversation member not found");
        }
        String reasonText = request.reasonText() == null ? "" : request.reasonText().trim();
        if (reasonText.isBlank() || reasonText.length() > 500) {
            throw new BadRequestException("reasonText is required and must be at most 500 characters");
        }
        Instant startsAt = request.startsAt() == null ? Instant.now() : request.startsAt();
        Instant now = Instant.now();
        if ("CONVERSATION".equals(scope) && startsAt.isAfter(now)) {
            throw new BadRequestException("conversation sanctions must start immediately");
        }
        if (request.expiresAt() != null && !request.expiresAt().isAfter(startsAt)) {
            throw new BadRequestException("expiresAt must be after startsAt");
        }
        if ("CONVERSATION".equals(scope) && "MUTE".equals(type) && request.expiresAt() == null) {
            throw new BadRequestException("conversation mute requires expiresAt");
        }
        ModerationRepository.SanctionRow sanction = repository.createSanction(
                request.userId(), scope, request.conversationId(), type, startsAt, request.expiresAt(),
                actorId, request.reasonCode(), reasonText);
        if ("APP".equals(scope) && "BAN".equals(type) && !startsAt.isAfter(now)) {
            store.updateUserAccountStatus(request.userId(), "BANNED", Instant.now());
        } else if ("APP".equals(scope) && "SUSPEND".equals(type) && !startsAt.isAfter(now)) {
            store.updateUserAccountStatus(request.userId(), "SUSPENDED", Instant.now());
        } else if ("CONVERSATION".equals(scope) && ("BAN".equals(type) || "SUSPEND".equals(type))) {
            store.banUserInConversation(request.conversationId(), request.userId(), actorId,
                    request.reasonCode(), reasonText, request.expiresAt());
        } else if ("CONVERSATION".equals(scope) && "MUTE".equals(type)) {
            store.updateMemberChatPolicy(request.conversationId(), request.userId(), request.expiresAt(), null);
        }
        events.record(actorId, request.conversationId(), "SANCTION_IMPOSED", "user_sanction",
                sanction.sanctionId().toString(), request.userId(), reasonText,
                Map.of(), Map.of("scope", scope, "sanctionType", type, "status", "ACTIVE"));
        return sanction;
    }

    public ModerationRepository.SanctionRow revokeSanction(
            UUID actorId, UUID userId, UUID imposedAt, UUID sanctionId, String reason) {
        authorization.require(actorId, AppPermission.REPORT_MANAGE);
        String normalizedReason = reason == null ? "" : reason.trim();
        if (normalizedReason.isBlank() || normalizedReason.length() > 500) {
            throw new BadRequestException("reason is required and must be at most 500 characters");
        }
        ModerationRepository.SanctionRow revoked = repository.revokeSanction(actorId, userId, imposedAt, sanctionId);
        if (revoked == null) throw new NotFoundException("active sanction not found");
        if ("APP".equals(revoked.scope()) && ("BAN".equals(revoked.sanctionType()) || "SUSPEND".equals(revoked.sanctionType()))) {
            var current = store.findUserById(userId);
            String expectedStatus = "BAN".equals(revoked.sanctionType()) ? "BANNED" : "SUSPENDED";
            if (current != null && expectedStatus.equalsIgnoreCase(current.accountStatus())
                    && !repository.hasActiveAppAccountLock(userId, Instant.now())) {
                store.updateUserAccountStatus(userId, "ACTIVE", Instant.now());
            }
        } else if ("CONVERSATION".equals(revoked.scope()) && ("BAN".equals(revoked.sanctionType()) || "SUSPEND".equals(revoked.sanctionType()))) {
            if (revoked.expiresAt() != null) {
                store.clearConversationBanIfExpiresAt(revoked.conversationId(), userId, revoked.expiresAt());
            } else {
                store.clearConversationBan(revoked.conversationId(), userId);
            }
        } else if ("CONVERSATION".equals(revoked.scope()) && "MUTE".equals(revoked.sanctionType())) {
            if (revoked.expiresAt() != null) {
                store.clearMemberMuteIfExpiresAt(revoked.conversationId(), userId, revoked.expiresAt());
            } else {
                store.updateMemberChatPolicy(revoked.conversationId(), userId, null, null);
            }
        }
        events.record(actorId, revoked.conversationId(), "SANCTION_REVOKED", "user_sanction",
                sanctionId.toString(), userId, normalizedReason,
                Map.of("status", "ACTIVE"), Map.of("status", "REVOKED"));
        return revoked;
    }

    private static String normalize(String value, Set<String> allowed, String field) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        if (!allowed.contains(normalized)) throw new BadRequestException(field + " is invalid");
        return normalized;
    }

    private static LocalDate parseDay(String day) {
        if (day == null || day.isBlank()) return LocalDate.now(java.time.ZoneOffset.UTC);
        try {
            return LocalDate.parse(day.trim());
        } catch (DateTimeParseException exception) {
            throw new BadRequestException("day must use YYYY-MM-DD format");
        }
    }

    public record ResolveReportRequest(
            String currentStatus,
            LocalDate reportDay,
            UUID createdAtKey,
            String nextStatus,
            UUID assignedTo,
            String resolutionCode,
            String reason) {
    }

    public record SanctionRequest(
            UUID userId,
            String scope,
            UUID conversationId,
            String sanctionType,
            Instant startsAt,
            Instant expiresAt,
            String reasonCode,
            String reasonText) {
    }
}
