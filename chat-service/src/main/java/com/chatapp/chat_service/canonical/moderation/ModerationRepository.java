package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
public class ModerationRepository {
    private final CqlSession session;
    private final PreparedStatement insertReportByStatus;
    private final PreparedStatement insertReportByReporter;
    private final PreparedStatement deleteReportByStatus;
    private final PreparedStatement listReportsByStatus;
    private final PreparedStatement listReportsByReporter;
    private final PreparedStatement insertSanction;
    private final PreparedStatement listSanctions;
    private final PreparedStatement loadSanction;
    private final PreparedStatement revokeSanction;
    private final PreparedStatement insertSanctionByExpiry;
    private final PreparedStatement listSanctionsByExpiryDay;
    private final PreparedStatement markSanctionExpired;
    private final PreparedStatement updateSanctionExpiryStatus;

    public ModerationRepository(CqlSession session) {
        this.session = session;
        this.insertReportByStatus = session.prepare("""
                INSERT INTO reports_by_status_day
                    (report_status, report_day, created_at, report_id, reporter_id, target_type,
                     target_user_id, conversation_id, message_bucket, message_id, reason_code,
                     description, assigned_to, resolved_at, resolution_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.insertReportByReporter = session.prepare("""
                INSERT INTO reports_by_reporter
                    (reporter_id, created_at, report_id, report_status, target_type,
                     target_user_id, conversation_id, message_bucket, message_id,
                     reason_code, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.deleteReportByStatus = session.prepare("""
                DELETE FROM reports_by_status_day
                WHERE report_status = ? AND report_day = ? AND created_at = ? AND report_id = ?
                """);
        this.listReportsByStatus = session.prepare("""
                SELECT * FROM reports_by_status_day
                WHERE report_status = ? AND report_day = ? LIMIT ?
                """);
        this.listReportsByReporter = session.prepare("""
                SELECT * FROM reports_by_reporter
                WHERE reporter_id = ? LIMIT ?
                """);
        this.insertSanction = session.prepare("""
                INSERT INTO user_sanctions_by_user
                    (user_id, imposed_at, sanction_id, scope, conversation_id, sanction_type,
                     starts_at, expires_at, imposed_by, reason_code, reason_text, status,
                     revoked_by, revoked_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listSanctions = session.prepare("""
                SELECT * FROM user_sanctions_by_user
                WHERE user_id = ? LIMIT ?
                """);
        this.loadSanction = session.prepare("""
                SELECT status, expires_at FROM user_sanctions_by_user
                WHERE user_id = ? AND imposed_at = ? AND sanction_id = ?
                """);
        this.revokeSanction = session.prepare("""
                UPDATE user_sanctions_by_user
                SET status = 'REVOKED', revoked_by = ?, revoked_at = ?
                WHERE user_id = ? AND imposed_at = ? AND sanction_id = ?
                """);
        this.insertSanctionByExpiry = session.prepare("""
                INSERT INTO user_sanctions_by_expiry_day
                    (expiry_day, expires_at, sanction_id, user_id, imposed_at, scope, conversation_id,
                     sanction_type, starts_at, imposed_by, reason_code, reason_text, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listSanctionsByExpiryDay = session.prepare("""
                SELECT * FROM user_sanctions_by_expiry_day
                WHERE expiry_day = ? AND expires_at <= ? LIMIT ?
                """);
        this.markSanctionExpired = session.prepare("""
                UPDATE user_sanctions_by_expiry_day SET status = 'EXPIRED'
                WHERE expiry_day = ? AND expires_at = ? AND sanction_id = ? IF status = 'ACTIVE'
                """);
        this.updateSanctionExpiryStatus = session.prepare("""
                UPDATE user_sanctions_by_expiry_day SET status = ?
                WHERE expiry_day = ? AND expires_at = ? AND sanction_id = ?
                """);
    }

    public ReportRow createReport(
            UUID reporterId,
            String targetType,
            UUID targetUserId,
            UUID conversationId,
            String messageBucket,
            UUID messageId,
            String reasonCode,
            String description) {
        UUID createdAtKey = Uuids.timeBased();
        UUID reportId = UUID.randomUUID();
        LocalDate reportDay = LocalDate.ofInstant(Instant.ofEpochMilli(Uuids.unixTimestamp(createdAtKey)), java.time.ZoneOffset.UTC);
        ReportRow report = new ReportRow(
                reportId, createdAtKey, reportDay, "OPEN", reporterId, targetType, targetUserId,
                conversationId, messageBucket, messageId, reasonCode, description, null, null, null);
        writeReport(report);
        return report;
    }

    public List<ReportRow> listReports(String status, LocalDate day, int limit) {
        return session.execute(listReportsByStatus.bind(status, day, Math.max(1, Math.min(limit, 200)))).all().stream()
                .map(this::mapReport)
                .toList();
    }

    public List<ReportRow> listReportsByReporter(UUID reporterId, int limit) {
        return session.execute(listReportsByReporter.bind(reporterId, Math.max(1, Math.min(limit, 100)))).all().stream()
                .map(this::mapReporterReport)
                .toList();
    }

    public ReportRow findReport(String status, LocalDate day, UUID reportId) {
        return listReports(status, day, 200).stream()
                .filter(report -> report.reportId().equals(reportId))
                .findFirst()
                .orElse(null);
    }

    public ReportRow transitionReport(ReportRow current, String nextStatus, UUID assignedTo, Instant resolvedAt, String resolutionCode) {
        ReportRow updated = new ReportRow(
                current.reportId(), current.createdAtKey(), current.reportDay(), nextStatus, current.reporterId(),
                current.targetType(), current.targetUserId(), current.conversationId(), current.messageBucket(),
                current.messageId(), current.reasonCode(), current.description(), assignedTo,
                resolvedAt, resolutionCode);
        writeReport(updated);
        // Write the new projection before deleting the old one so a transient
        // failure cannot make a report disappear from both status partitions.
        session.execute(deleteReportByStatus.bind(current.status(), current.reportDay(), current.createdAtKey(), current.reportId()));
        // The reporter projection uses the same primary key across status
        // transitions. `writeReport` above updates it in place; deleting it
        // here would make the report disappear from GET /reports/mine.
        return updated;
    }

    public SanctionRow createSanction(
            UUID userId,
            String scope,
            UUID conversationId,
            String sanctionType,
            Instant startsAt,
            Instant expiresAt,
            UUID imposedBy,
            String reasonCode,
            String reasonText) {
        UUID imposedAt = Uuids.timeBased();
        UUID sanctionId = UUID.randomUUID();
        session.execute(insertSanction.bind(
                userId, imposedAt, sanctionId, scope, conversationId, sanctionType,
                startsAt, expiresAt, imposedBy, reasonCode, reasonText, "ACTIVE", null, null));
        if (expiresAt != null) {
            session.execute(insertSanctionByExpiry.bind(
                    expiresAt.atZone(ZoneOffset.UTC).toLocalDate(), expiresAt, sanctionId, userId, imposedAt,
                    scope, conversationId, sanctionType, startsAt, imposedBy, reasonCode, reasonText, "ACTIVE"));
        }
        return new SanctionRow(userId, imposedAt, sanctionId, scope, conversationId, sanctionType,
                startsAt, expiresAt, imposedBy, reasonCode, reasonText, "ACTIVE", null, null);
    }

    public List<SanctionRow> listSanctions(UUID userId, int limit) {
        return session.execute(listSanctions.bind(userId, Math.max(1, Math.min(limit, 100)))).all().stream()
                .map(this::mapSanction)
                .toList();
    }

    /**
     * Checks the authoritative sanction row before applying a potentially
     * stale expiry projection (for example while a revoke projection update is
     * still propagating).
     */
    public boolean isSanctionActive(SanctionRow sanction) {
        if (sanction == null) return false;
        Row row = session.execute(loadSanction.bind(
                sanction.userId(), sanction.imposedAt(), sanction.sanctionId())).one();
        return row != null
                && "ACTIVE".equals(row.getString("status"))
                && java.util.Objects.equals(row.getInstant("expires_at"), sanction.expiresAt());
    }

    public boolean hasActiveAppSanction(UUID userId, Instant now) {
        return listSanctions(userId, 100).stream()
                // WARNING is an auditable notice, not a send-blocking sanction.
                .filter(row -> "APP".equals(row.scope()) && "ACTIVE".equals(row.status())
                        && java.util.Set.of("BAN", "MUTE", "SUSPEND").contains(row.sanctionType()))
                .anyMatch(row -> (row.startsAt() == null || !row.startsAt().isAfter(now))
                        && (row.expiresAt() == null || row.expiresAt().isAfter(now)));
    }

    /**
     * Returns only account-locking sanctions. An application MUTE still blocks
     * sends through {@link #hasActiveAppSanction(UUID, Instant)}, but it must
     * not prevent a timed BAN/SUSPEND from restoring the account status.
     */
    public boolean hasActiveAppAccountLock(UUID userId, Instant now) {
        return listSanctions(userId, 100).stream()
                .filter(row -> "APP".equals(row.scope()) && "ACTIVE".equals(row.status())
                        && java.util.Set.of("BAN", "SUSPEND").contains(row.sanctionType()))
                .anyMatch(row -> (row.startsAt() == null || !row.startsAt().isAfter(now))
                        && (row.expiresAt() == null || row.expiresAt().isAfter(now)));
    }

    public SanctionRow revokeSanction(UUID actorId, UUID userId, UUID imposedAt, UUID sanctionId) {
        List<SanctionRow> current = listSanctions(userId, 100).stream()
                .filter(row -> "ACTIVE".equals(row.status())
                        && row.imposedAt().equals(imposedAt) && row.sanctionId().equals(sanctionId))
                .toList();
        if (current.isEmpty()) return null;
        Instant revokedAt = Instant.now();
        session.execute(revokeSanction.bind(actorId, revokedAt, userId, imposedAt, sanctionId));
        SanctionRow row = current.get(0);
        if (row.expiresAt() != null) {
            session.execute(updateSanctionExpiryStatus.bind(
                    "REVOKED", row.expiresAt().atZone(ZoneOffset.UTC).toLocalDate(), row.expiresAt(), row.sanctionId()));
        }
        return new SanctionRow(row.userId(), row.imposedAt(), row.sanctionId(), row.scope(), row.conversationId(),
                row.sanctionType(), row.startsAt(), row.expiresAt(), row.imposedBy(), row.reasonCode(),
                row.reasonText(), "REVOKED", actorId, revokedAt);
    }

    /** Read only a bounded window of timed sanctions that are due for expiry. */
    public List<SanctionRow> listDueSanctions(Instant now, int lookbackDays, int limitPerDay) {
        Instant effectiveNow = now == null ? Instant.now() : now;
        int boundedDays = Math.max(1, Math.min(31, lookbackDays));
        int boundedLimit = Math.max(1, Math.min(200, limitPerDay));
        LocalDate today = effectiveNow.atZone(ZoneOffset.UTC).toLocalDate();
        List<SanctionRow> due = new java.util.ArrayList<>();
        for (int offset = 0; offset < boundedDays; offset++) {
            LocalDate day = today.minusDays(offset);
            session.execute(listSanctionsByExpiryDay.bind(day, effectiveNow, boundedLimit))
                    .all().stream().map(this::mapExpirySanction).forEach(due::add);
        }
        return due;
    }

    /** Claim expiry with a lightweight transaction so multiple nodes cannot apply it twice. */
    public boolean markSanctionExpired(SanctionRow sanction) {
        if (sanction == null || sanction.expiresAt() == null) return false;
        return session.execute(markSanctionExpired.bind(
                sanction.expiresAt().atZone(ZoneOffset.UTC).toLocalDate(),
                sanction.expiresAt(), sanction.sanctionId())).wasApplied();
    }

    private void writeReport(ReportRow report) {
        session.execute(insertReportByStatus.bind(
                report.status(), report.reportDay(), report.createdAtKey(), report.reportId(), report.reporterId(),
                report.targetType(), report.targetUserId(), report.conversationId(), report.messageBucket(),
                report.messageId(), report.reasonCode(), report.description(), report.assignedTo(),
                report.resolvedAt(), report.resolutionCode()));
        session.execute(insertReportByReporter.bind(
                report.reporterId(), report.createdAtKey(), report.reportId(), report.status(), report.targetType(),
                report.targetUserId(), report.conversationId(), report.messageBucket(), report.messageId(),
                report.reasonCode(), report.description()));
    }

    private ReportRow mapReport(Row row) {
        UUID createdAtKey = row.getUuid("created_at");
        return new ReportRow(
                row.getUuid("report_id"), createdAtKey,
                row.getLocalDate("report_day"), row.getString("report_status"), row.getUuid("reporter_id"),
                row.getString("target_type"), row.getUuid("target_user_id"), row.getUuid("conversation_id"),
                row.getString("message_bucket"), row.getUuid("message_id"), row.getString("reason_code"),
                row.getString("description"), row.getUuid("assigned_to"), row.getInstant("resolved_at"),
                row.getString("resolution_code"));
    }

    private ReportRow mapReporterReport(Row row) {
        UUID createdAtKey = row.getUuid("created_at");
        return new ReportRow(
                row.getUuid("report_id"), createdAtKey,
                LocalDate.ofInstant(Instant.ofEpochMilli(Uuids.unixTimestamp(createdAtKey)), java.time.ZoneOffset.UTC),
                row.getString("report_status"), row.getUuid("reporter_id"), row.getString("target_type"),
                row.getUuid("target_user_id"), row.getUuid("conversation_id"), row.getString("message_bucket"),
                row.getUuid("message_id"), row.getString("reason_code"), row.getString("description"), null, null, null);
    }

    private SanctionRow mapSanction(Row row) {
        Instant expiresAt = row.getInstant("expires_at");
        String persistedStatus = row.getString("status");
        String effectiveStatus = "ACTIVE".equals(persistedStatus)
                && expiresAt != null
                && !expiresAt.isAfter(Instant.now())
                ? "EXPIRED"
                : persistedStatus;
        return new SanctionRow(
                row.getUuid("user_id"), row.getUuid("imposed_at"), row.getUuid("sanction_id"),
                row.getString("scope"), row.getUuid("conversation_id"), row.getString("sanction_type"),
                row.getInstant("starts_at"), expiresAt, row.getUuid("imposed_by"),
                row.getString("reason_code"), row.getString("reason_text"), effectiveStatus,
                row.getUuid("revoked_by"), row.getInstant("revoked_at"));
    }

    private SanctionRow mapExpirySanction(Row row) {
        return new SanctionRow(
                row.getUuid("user_id"), row.getUuid("imposed_at"), row.getUuid("sanction_id"),
                row.getString("scope"), row.getUuid("conversation_id"), row.getString("sanction_type"),
                row.getInstant("starts_at"), row.getInstant("expires_at"), row.getUuid("imposed_by"),
                row.getString("reason_code"), row.getString("reason_text"), row.getString("status"),
                null, null);
    }

    public record ReportRow(
            UUID reportId,
            UUID createdAtKey,
            LocalDate reportDay,
            String status,
            UUID reporterId,
            String targetType,
            UUID targetUserId,
            UUID conversationId,
            String messageBucket,
            UUID messageId,
            String reasonCode,
            String description,
            UUID assignedTo,
            Instant resolvedAt,
            String resolutionCode) {
    }

    public record SanctionRow(
            UUID userId,
            UUID imposedAt,
            UUID sanctionId,
            String scope,
            UUID conversationId,
            String sanctionType,
            Instant startsAt,
            Instant expiresAt,
            UUID imposedBy,
            String reasonCode,
            String reasonText,
            String status,
            UUID revokedBy,
            Instant revokedAt) {
    }
}
