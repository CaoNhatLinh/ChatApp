package com.chatapp.chat_service.canonical.moderation;

import com.datastax.oss.driver.api.core.CqlSession;
import com.chatapp.chat_service.canonical.messaging.ReportOutboxRoute;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Repository
public class ModerationRepository {
    static final int REPORT_WORK_SHARDS = 16;
    static final String CREATE_WORK = "CREATE";
    private static final int MAX_REPORT_WORK_PAGE = 50;
    private static final int REPORT_STATUS_READ_CONCURRENCY = 8;
    private final CqlSession session;
    private final PreparedStatement insertReportByStatus;
    private final PreparedStatement insertReportByReporter;
    private final PreparedStatement insertCreateCommand;
    private final PreparedStatement selectCreateCommand;
    private final PreparedStatement insertCreatePreparation;
    private final PreparedStatement selectCreatePreparation;
    private final PreparedStatement listCreatePreparations;
    private final PreparedStatement listCreatePreparationsAfter;
    private final PreparedStatement deleteCreatePreparation;
    private final PreparedStatement deleteReportByStatus;
    private final PreparedStatement listReportsByStatus;
    private final PreparedStatement reportByQueueKey;
    private final PreparedStatement currentReportStatus;
    private final PreparedStatement reportProjectionStamp;
    private final PreparedStatement claimReportStatus;
    private final PreparedStatement registerReportWork;
    private final PreparedStatement listReportWork;
    private final PreparedStatement listReportWorkAfter;
    private final PreparedStatement loadReportWorkAuthority;
    private final PreparedStatement markReportWork;
    private final PreparedStatement deleteReportWork;
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
        this.insertCreateCommand = session.prepare("""
                INSERT INTO report_create_commands (reporter_id, client_report_id, fingerprint, created_at, report_id, target_user_id)
                VALUES (?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.selectCreateCommand = session.prepare("""
                SELECT fingerprint, created_at, report_id, target_user_id FROM report_create_commands
                WHERE reporter_id = ? AND client_report_id = ?
                """);
        this.insertCreatePreparation = session.prepare("""
                INSERT INTO report_create_preparation_by_shard
                    (work_shard, reporter_id, client_report_id, fingerprint, created_at, report_id, target_user_id,
                     target_type, conversation_id, message_bucket, message_id, reason_code, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.selectCreatePreparation = session.prepare("""
                SELECT * FROM report_create_preparation_by_shard
                WHERE work_shard = ? AND reporter_id = ? AND client_report_id = ?
                """);
        this.listCreatePreparations = session.prepare("""
                SELECT * FROM report_create_preparation_by_shard WHERE work_shard = ? LIMIT ?
                """);
        this.listCreatePreparationsAfter = session.prepare("""
                SELECT * FROM report_create_preparation_by_shard
                WHERE work_shard = ? AND (reporter_id, client_report_id) > (?, ?) LIMIT ?
                """);
        this.deleteCreatePreparation = session.prepare("""
                DELETE FROM report_create_preparation_by_shard
                WHERE work_shard = ? AND reporter_id = ? AND client_report_id = ? IF report_id = ?
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
                SELECT reporter_id, created_at, report_id, report_status, target_type, target_user_id,
                       conversation_id, message_bucket, message_id, reason_code, description
                FROM reports_by_reporter
                WHERE reporter_id = ? LIMIT ?
                """);
        this.reportByQueueKey = session.prepare("""
                SELECT * FROM reports_by_status_day
                WHERE report_status = ? AND report_day = ? AND created_at = ? AND report_id = ?
                """);
        this.currentReportStatus = session.prepare("""
                SELECT report_status FROM reports_by_reporter
                WHERE reporter_id = ? AND created_at = ? AND report_id = ?
                """);
        this.reportProjectionStamp = session.prepare("""
                SELECT writetime(reporter_id) AS projection_stamp FROM reports_by_status_day
                WHERE report_status = ? AND report_day = ? AND created_at = ? AND report_id = ?
                """);
        this.claimReportStatus = session.prepare("""
                UPDATE reports_by_reporter SET report_status = ?, decision_intents = decision_intents + ?
                WHERE reporter_id = ? AND created_at = ? AND report_id = ? IF report_status = ?
                """);
        this.registerReportWork = session.prepare("""
                INSERT INTO report_decision_work_by_shard
                    (work_shard, report_id, previous_status, reporter_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listReportWork = session.prepare("""
                SELECT report_id, previous_status, reporter_id, created_at
                FROM report_decision_work_by_shard WHERE work_shard = ? LIMIT ?
                """);
        this.listReportWorkAfter = session.prepare("""
                SELECT report_id, previous_status, reporter_id, created_at
                FROM report_decision_work_by_shard
                WHERE work_shard = ? AND (report_id, previous_status) > (?, ?) LIMIT ?
                """);
        this.loadReportWorkAuthority = session.prepare("""
                SELECT reporter_id, created_at, report_id, report_status, target_type, target_user_id,
                       conversation_id, message_bucket, message_id, reason_code, description, decision_intents
                FROM reports_by_reporter WHERE reporter_id = ? AND created_at = ? AND report_id = ?
                """);
        this.markReportWork = session.prepare("""
                UPDATE reports_by_reporter SET decision_intents = decision_intents + ?
                WHERE reporter_id = ? AND created_at = ? AND report_id = ? IF EXISTS
                """);
        this.deleteReportWork = session.prepare("""
                DELETE FROM report_decision_work_by_shard
                WHERE work_shard = ? AND report_id = ? AND previous_status = ?
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
        return seedReport(reporterId, Uuids.timeBased(), UUID.randomUUID(), targetType, targetUserId,
                conversationId, messageBucket, messageId, reasonCode, description, false);
    }

    record CreateCommand(String fingerprint, UUID createdAtKey, UUID reportId, UUID targetUserId) {}
    record CreatePreparation(byte shard, UUID reporterId, UUID clientId, CreateCommand command, String targetType,
                             UUID conversationId, String bucket, UUID messageId, String reasonCode, String description) {
        CreatePreparationCursor cursor() { return new CreatePreparationCursor(shard, reporterId, clientId); }
    }
    record CreatePreparationCursor(byte shard, UUID reporterId, UUID clientId) {}

    CreateCommand findCreateCommand(UUID reporterId, UUID clientId) {
        Row row = session.execute(selectCreateCommand.bind(reporterId, clientId)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
        return row == null ? null : new CreateCommand(row.getString("fingerprint"), row.getUuid("created_at"),
                row.getUuid("report_id"), row.getUuid("target_user_id"));
    }

    CreatePreparation prepareCreate(UUID reporterId, UUID clientId, String fingerprint, UUID targetUserId,
                                   String targetType, UUID conversationId, String bucket, UUID messageId,
                                   String reasonCode, String description) {
        byte shard = createPreparationShard(reporterId, clientId);
        var candidate = new CreateCommand(fingerprint, Uuids.timeBased(), UUID.randomUUID(), targetUserId);
        Row outcome = session.execute(insertCreatePreparation.bind(shard, reporterId, clientId, fingerprint,
                        candidate.createdAtKey(), candidate.reportId(), targetUserId, targetType, conversationId,
                        bucket, messageId, reasonCode, description)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL)).one();
        if (outcome == null) throw new IllegalStateException("Report preparation result is unavailable");
        if (!outcome.getBoolean("[applied]")) return mapCreatePreparation(outcome);
        return new CreatePreparation(shard, reporterId, clientId, candidate, targetType, conversationId, bucket,
                messageId, reasonCode, description);
    }

    CreatePreparation findCreatePreparation(UUID reporterId, UUID clientId) {
        Row row = session.execute(selectCreatePreparation.bind(createPreparationShard(reporterId, clientId), reporterId, clientId)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
        return row == null ? null : mapCreatePreparation(row);
    }

    private static byte createPreparationShard(UUID reporterId, UUID clientId) {
        return (byte) Math.floorMod(31 * reporterId.hashCode() + clientId.hashCode(), REPORT_WORK_SHARDS);
    }

    List<CreatePreparation> createPreparationPage(byte shard, CreatePreparationCursor after, int limit) {
        if (shard < 0 || shard >= REPORT_WORK_SHARDS || (after != null && after.shard() != shard)) {
            throw new IllegalArgumentException("invalid report preparation shard or cursor");
        }
        int bounded = Math.max(1, Math.min(limit, MAX_REPORT_WORK_PAGE));
        BoundStatement query = after == null ? listCreatePreparations.bind(shard, bounded)
                : listCreatePreparationsAfter.bind(shard, after.reporterId(), after.clientId(), bounded);
        return session.execute(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(this::mapCreatePreparation).toList();
    }

    private CreatePreparation mapCreatePreparation(Row row) {
        var command = new CreateCommand(row.getString("fingerprint"), row.getUuid("created_at"),
                row.getUuid("report_id"), row.getUuid("target_user_id"));
        return new CreatePreparation(row.getByte("work_shard"), row.getUuid("reporter_id"),
                row.getUuid("client_report_id"), command, row.getString("target_type"), row.getUuid("conversation_id"),
                row.getString("message_bucket"), row.getUuid("message_id"), row.getString("reason_code"), row.getString("description"));
    }

    ReportRow resumePreparedCreate(CreatePreparation preparation) {
        UUID reporter = preparation.reporterId();
        var candidate = preparation.command();
        var winner = findCreateCommand(reporter, preparation.clientId());
        if (winner == null) winner = claimCreateCommand(reporter, preparation.clientId(), candidate);
        ReportRow report = candidate.fingerprint().equals(winner.fingerprint())
                ? completeCreateCommand(reporter, winner, preparation.targetType(), preparation.conversationId(),
                        preparation.bucket(), preparation.messageId(), preparation.reasonCode(), preparation.description()) : null;
        // A delayed worker must not delete a different preparation created after this one completed.
        session.execute(deleteCreatePreparation.bind(preparation.shard(), reporter, preparation.clientId(), candidate.reportId())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL));
        return report;
    }

    private CreateCommand claimCreateCommand(UUID reporterId, UUID clientId, CreateCommand candidate) {
        boolean applied = session.execute(insertCreateCommand.bind(reporterId, clientId, candidate.fingerprint(),
                        candidate.createdAtKey(), candidate.reportId(), candidate.targetUserId())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL)).wasApplied();
        if (applied) return candidate;
        var existing = findCreateCommand(reporterId, clientId);
        if (existing == null) throw new IllegalStateException("Report command claim is unavailable");
        return existing;
    }

    ReportRow completeCreateCommand(UUID reporterId, CreateCommand command, String targetType, UUID conversationId,
                                    String bucket, UUID messageId, String reasonCode, String description) {
        var existing = findReportByIdentity(reporterId, command.createdAtKey(), command.reportId());
        if (existing != null) return existing;
        seedReport(reporterId, command.createdAtKey(), command.reportId(), targetType, command.targetUserId(),
                conversationId, bucket, messageId, reasonCode, description, true);
        var current = findReportByIdentity(reporterId, command.createdAtKey(), command.reportId());
        if (current == null) throw new IllegalStateException("Created report is unavailable");
        return current;
    }

    private ReportRow seedReport(UUID reporterId, UUID createdAtKey, UUID reportId, String targetType, UUID targetUserId,
                                 UUID conversationId, String messageBucket, UUID messageId, String reasonCode,
                                 String description, boolean keyed) {
        LocalDate reportDay = LocalDate.ofInstant(Instant.ofEpochMilli(Uuids.unixTimestamp(createdAtKey)), java.time.ZoneOffset.UTC);
        ReportRow report = new ReportRow(
                reportId, createdAtKey, reportDay, "OPEN", reporterId, targetType, targetUserId,
                conversationId, messageBucket, messageId, reasonCode, description, null, null, null);
        var authority = insertReportByReporter.bind(
                report.reporterId(), report.createdAtKey(), report.reportId(), report.status(), report.targetType(),
                report.targetUserId(), report.conversationId(), report.messageBucket(), report.messageId(),
                report.reasonCode(), report.description());
        var batch = BatchStatement.builder(BatchType.LOGGED)
                .addStatement(authority)
                .addStatement(reportStatusInsert(report))
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        if (keyed) {
            // Delayed seeding cannot overwrite a newer decision or resurrect its deleted OPEN projection.
            batch.setQueryTimestamp(1L).addStatement(registerReportWork.bind(reportWorkKey(report).shard(),
                    reportId, CREATE_WORK, reporterId, createdAtKey));
        }
        session.execute(batch.build());
        return report;
    }

    public List<ReportRow> listReports(String status, LocalDate day, int limit) {
        var candidates = session.execute(listReportsByStatus.bind(status, day, Math.max(1, Math.min(limit, 200)))
                        .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(this::mapReport)
                .toList();
        // Queue rows are projections and can lag the winning decision.
        List<ReportRow> visible = new ArrayList<>(candidates.size());
        for (int offset = 0; offset < candidates.size(); offset += REPORT_STATUS_READ_CONCURRENCY) {
            var chunk = candidates.subList(offset, Math.min(candidates.size(), offset + REPORT_STATUS_READ_CONCURRENCY));
            List<CompletableFuture<Boolean>> checks = chunk.stream()
                    .map(candidate -> hasCurrentReportStatus(candidate, status)).toList();
            for (int i = 0; i < chunk.size(); i++) {
                if (checks.get(i).join()) visible.add(chunk.get(i));
            }
        }
        return List.copyOf(visible);
    }

    private CompletableFuture<Boolean> hasCurrentReportStatus(ReportRow report, String status) {
        return session.executeAsync(currentReportStatus.bind(report.reporterId(), report.createdAtKey(), report.reportId())
                        .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM))
                .thenApply(result -> {
                    Row row = result.one();
                    return row != null && status.equals(row.getString("report_status"));
                }).toCompletableFuture();
    }

    public List<ReportRow> listReportsByReporter(UUID reporterId, int limit) {
        return session.execute(listReportsByReporter.bind(reporterId, Math.max(1, Math.min(limit, 100)))
                        .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(this::mapReporterReport)
                .toList();
    }

    public ReportRow findReport(String status, LocalDate day, UUID createdAtKey, UUID reportId) {
        Row row = session.execute(reportByQueueKey.bind(status, day, createdAtKey, reportId)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
        return row == null ? null : mapReport(row);
    }

    public ReportRow findReportByIdentity(UUID reporterId, UUID createdAtKey, UUID reportId) {
        Row row = loadReportAuthority(reporterId, createdAtKey, reportId);
        if (row == null) return null;
        ReportRow report = mapReporterReport(row);
        if ("OPEN".equals(report.status())) return report;

        Map<String, String> intents = row.getMap("decision_intents", String.class, String.class);
        if (intents != null) {
            String prefix = report.status().equals(intents.get("IN_REVIEW.nextStatus")) ? "IN_REVIEW." : "OPEN.";
            if (report.status().equals(intents.get(prefix + "nextStatus"))) {
                String resolvedAt = intents.get(prefix + "resolvedAt");
                return report.withDecisionMetadata(UUID.fromString(intents.get(prefix + "assignedTo")),
                        resolvedAt == null ? null : Instant.parse(resolvedAt), intents.get(prefix + "resolutionCode"));
            }
        }
        // Older decisions only have decision metadata in their status projection.
        ReportRow legacy = findReport(report.status(), report.reportDay(), createdAtKey, reportId);
        return legacy != null && reporterId.equals(legacy.reporterId())
                ? report.withDecisionMetadata(legacy.assignedTo(), legacy.resolvedAt(), legacy.resolutionCode()) : report;
    }

    public ReportRow transitionReport(ReportRow current, String nextStatus, UUID assignedTo, Instant resolvedAt,
                                      String resolutionCode, UUID actorId, String reason, UUID decisionId) {
        Row source = session.execute(reportProjectionStamp.bind(current.status(), current.reportDay(),
                        current.createdAtKey(), current.reportId())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
        if (source == null) return null;
        if (source.isNull("projection_stamp")) throw new IllegalStateException("report projection stamp missing");
        long stamp = Math.max(Math.multiplyExact(Uuids.unixTimestamp(decisionId), 1_000L),
                Math.addExact(source.getLong("projection_stamp"), 1L));
        ReportRow updated = new ReportRow(
                current.reportId(), current.createdAtKey(), current.reportDay(), nextStatus, current.reporterId(),
                current.targetType(), current.targetUserId(), current.conversationId(), current.messageBucket(),
                current.messageId(), current.reasonCode(), current.description(), assignedTo,
                resolvedAt, resolutionCode);
        // Publish a discoverable pointer before CAS. A loser cannot remove a
        // shared pointer because another request might already have won.
        byte shard = reportWorkKey(current).shard();
        session.execute(registerReportWork.bind(shard, current.reportId(), current.status(),
                current.reporterId(), current.createdAtKey()).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM));
        var claim = claimReportStatus.bind(nextStatus, decisionIntent(current, updated, actorId, reason, decisionId, stamp),
                        current.reporterId(), current.createdAtKey(),
                        current.reportId(), current.status())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        if (!session.execute(claim).wasApplied()) return null;

        // Only the winning decision moves the queue row. A crash before this
        // batch is submitted still requires durable decision recovery.
        writeReportProjection(updated, current.status(), stamp, true);
        return updated;
    }

    void replayReportProjection(ReportWorkKey key, ReportWorkAuthority authority) {
        var report = authority.report();
        var intent = authority.intent();
        if (!key.reportId().equals(report.reportId()) || !key.reporterId().equals(report.reporterId())
                || !key.createdAt().equals(report.createdAtKey())) {
            throw new IllegalArgumentException("report work identity mismatch");
        }
        String next = intent.get("nextStatus");
        boolean sourceOpen = "OPEN".equals(key.previousStatus());
        boolean terminal = "RESOLVED".equals(next) || "DISMISSED".equals(next);
        if (!(sourceOpen && "IN_REVIEW".equals(next))
                && !(terminal && (sourceOpen || "IN_REVIEW".equals(key.previousStatus())))) {
            throw new IllegalArgumentException("invalid persisted report transition");
        }
        boolean currentDestination = next.equals(report.status());
        boolean superseded = "IN_REVIEW".equals(next)
                && ("RESOLVED".equals(report.status()) || "DISMISSED".equals(report.status()));
        if (!currentDestination && !superseded) {
            throw new IllegalStateException("report authority does not match persisted transition");
        }
        long stamp = Long.parseLong(intent.get("projectionStamp"));
        if (stamp <= 0) throw new IllegalArgumentException("invalid report projection stamp");
        var updated = new ReportRow(report.reportId(), report.createdAtKey(), report.reportDay(), next,
                report.reporterId(), report.targetType(), report.targetUserId(), report.conversationId(),
                report.messageBucket(), report.messageId(), report.reasonCode(), report.description(),
                UUID.fromString(intent.get("assignedTo")), terminal ? Instant.parse(intent.get("resolvedAt")) : null,
                intent.get("resolutionCode"));
        // An obsolete decision can clean its source without reinserting its destination.
        writeReportProjection(updated, key.previousStatus(), stamp, currentDestination);
    }

    private void writeReportProjection(ReportRow updated, String previousStatus, long stamp, boolean insertDestination) {
        var batch = BatchStatement.builder(BatchType.LOGGED)
                .setQueryTimestamp(stamp)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        if (insertDestination) batch.addStatement(reportStatusInsert(updated));
        batch.addStatement(deleteReportByStatus.bind(previousStatus, updated.reportDay(),
                updated.createdAtKey(), updated.reportId()));
        session.execute(batch.build());
    }

    List<ReportWorkKey> reportWorkPage(byte shard, ReportWorkKey after, int limit) {
        if (shard < 0 || shard >= REPORT_WORK_SHARDS || (after != null && after.shard() != shard)) {
            throw new IllegalArgumentException("invalid report work shard or cursor");
        }
        int bounded = Math.max(1, Math.min(limit, MAX_REPORT_WORK_PAGE));
        BoundStatement query = after == null ? listReportWork.bind(shard, bounded)
                : listReportWorkAfter.bind(shard, after.reportId(), after.previousStatus(), bounded);
        return session.execute(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(row -> new ReportWorkKey(shard, row.getUuid("report_id"), row.getString("previous_status"),
                        row.getUuid("reporter_id"), row.getUuid("created_at"))).toList();
    }

    ReportWorkAuthority reportWorkAuthority(ReportWorkKey key) {
        Row row = loadReportAuthority(key.reporterId(), key.createdAt(), key.reportId());
        if (row == null) return null;
        ReportRow report = mapReporterReport(row);
        Map<String, String> decisions = row.getMap("decision_intents", String.class, String.class);
        if (decisions == null || decisions.isEmpty()) return new ReportWorkAuthority(report, Map.of());
        String prefix = key.previousStatus() + ".";
        Map<String, String> intent = new HashMap<>();
        decisions.forEach((field, value) -> {
            if (field.startsWith(prefix)) intent.put(field.substring(prefix.length()), value);
        });
        return new ReportWorkAuthority(report, Map.copyOf(intent));
    }

    private Row loadReportAuthority(UUID reporterId, UUID createdAtKey, UUID reportId) {
        return session.execute(loadReportWorkAuthority.bind(reporterId, createdAtKey, reportId)
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).one();
    }

    record ReportWorkKey(byte shard, UUID reportId, String previousStatus, UUID reporterId, UUID createdAt) {}
    record ReportWorkAuthority(ReportRow report, Map<String, String> intent) {}

    static ReportWorkKey reportWorkKey(ReportRow report) {
        return new ReportWorkKey((byte) Math.floorMod(report.reportId().hashCode(), REPORT_WORK_SHARDS),
                report.reportId(), report.status(), report.reporterId(), report.createdAtKey());
    }

    void markReportAuditRecovered(ReportWorkKey key) {
        markReportWork(key, Map.of(key.previousStatus() + ".recovered", "true"));
    }

    void markReportEnqueued(ReportWorkKey key) {
        String prefix = key.previousStatus() + ".";
        markReportWork(key, Map.of(prefix + "recovered", "true", prefix + "enqueued", "true"));
        removeReportWork(key);
    }

    private void markReportWork(ReportWorkKey key, Map<String, String> markers) {
        var result = session.execute(markReportWork.bind(markers, key.reporterId(), key.createdAt(), key.reportId())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL));
        if (!result.wasApplied()) throw new IllegalStateException("report authority disappeared");
    }

    void removeReportWork(ReportWorkKey key) {
        session.execute(deleteReportWork.bind(key.shard(), key.reportId(), key.previousStatus())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM));
    }

    private static Map<String, String> decisionIntent(ReportRow current, ReportRow updated, UUID actorId,
                                                      String reason, UUID decisionId, long stamp) {
        // Transitions are acyclic: separate OPEN and IN_REVIEW entries preserve
        // both decisions even if terminal handling starts before review audit completes.
        String prefix = current.status() + ".";
        Map<String, String> intent = new HashMap<>();
        intent.put(prefix + "id", decisionId.toString());
        intent.put(prefix + "projectionStamp", Long.toString(stamp));
        intent.put(prefix + "outboxRoute", ReportOutboxRoute.VERSION);
        intent.put(prefix + "nextStatus", updated.status());
        intent.put(prefix + "actorId", actorId.toString());
        intent.put(prefix + "assignedTo", updated.assignedTo().toString());
        intent.put(prefix + "reason", reason);
        if (updated.resolvedAt() != null) intent.put(prefix + "resolvedAt", updated.resolvedAt().toString());
        if (updated.resolutionCode() != null) intent.put(prefix + "resolutionCode", updated.resolutionCode());
        return intent;
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

    private BoundStatement reportStatusInsert(ReportRow report) {
        return insertReportByStatus.bind(
                report.status(), report.reportDay(), report.createdAtKey(), report.reportId(), report.reporterId(),
                report.targetType(), report.targetUserId(), report.conversationId(), report.messageBucket(),
                report.messageId(), report.reasonCode(), report.description(), report.assignedTo(),
                report.resolvedAt(), report.resolutionCode());
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
        private ReportRow withDecisionMetadata(UUID assignee, Instant resolutionTime, String code) {
            return new ReportRow(reportId, createdAtKey, reportDay, status, reporterId, targetType, targetUserId,
                    conversationId, messageBucket, messageId, reasonCode, description, assignee, resolutionTime, code);
        }
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
