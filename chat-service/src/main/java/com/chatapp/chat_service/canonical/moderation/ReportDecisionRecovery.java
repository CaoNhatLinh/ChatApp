package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.messaging.CassandraOutboxPublisher;
import com.chatapp.chat_service.canonical.messaging.ReportOutboxRoute;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class ReportDecisionRecovery {
    private static final Logger LOG = LoggerFactory.getLogger(ReportDecisionRecovery.class);
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneOffset.UTC);
    private static final int PAGE_SIZE = 25;
    private final ModerationRepository repository;
    private final CanonicalEventRecorder events;
    private final Optional<CassandraOutboxPublisher> outboxPublisher;
    private final ModerationRepository.ReportWorkKey[] cursors =
            new ModerationRepository.ReportWorkKey[ModerationRepository.REPORT_WORK_SHARDS];
    private final ModerationRepository.CreatePreparationCursor[] preparationCursors =
            new ModerationRepository.CreatePreparationCursor[ModerationRepository.REPORT_WORK_SHARDS];
    private int nextShard;

    public ReportDecisionRecovery(ModerationRepository repository, CanonicalEventRecorder events,
                                  Optional<CassandraOutboxPublisher> outboxPublisher) {
        this.repository = repository;
        this.events = events;
        this.outboxPublisher = outboxPublisher;
    }

    @Scheduled(fixedDelayString = "${app.moderation.report-recovery-delay-ms:5000}")
    public synchronized void recover() {
        byte shard = (byte) nextShard;
        nextShard = (nextShard + 1) % cursors.length;
        recoverPreparations(shard);
        try {
            var page = repository.reportWorkPage(shard, cursors[shard], PAGE_SIZE);
            cursors[shard] = page.isEmpty() ? null : page.get(page.size() - 1);
            var legacy = new LinkedHashMap<UUID, ModerationRepository.ReportWorkKey>();
            for (var key : page) {
                try {
                    recover(key, legacy);
                } catch (RuntimeException failure) {
                    LOG.warn("Report decision recovery retained work ({})", failure.getClass().getSimpleName());
                }
            }
            if (!legacy.isEmpty()) {
                for (UUID decisionId : outboxPublisher.orElseThrow().publishLegacyReports(List.copyOf(legacy.keySet()))) {
                    try {
                        repository.markReportEnqueued(legacy.get(decisionId));
                    } catch (RuntimeException failure) {
                        LOG.warn("Report decision recovery retained acknowledged work ({})", failure.getClass().getSimpleName());
                    }
                }
            }
        } catch (RuntimeException failure) {
            LOG.warn("Report decision recovery could not complete work ({})", failure.getClass().getSimpleName());
        }
    }

    private void recoverPreparations(byte shard) {
        try {
            var page = repository.createPreparationPage(shard, preparationCursors[shard], PAGE_SIZE);
            preparationCursors[shard] = page.isEmpty() ? null : page.get(page.size() - 1).cursor();
            for (var preparation : page) {
                try {
                    repository.resumePreparedCreate(preparation);
                } catch (RuntimeException failure) {
                    LOG.warn("Report creation recovery retained work ({})", failure.getClass().getSimpleName());
                }
            }
        } catch (RuntimeException failure) {
            LOG.warn("Report creation recovery could not read work ({})", failure.getClass().getSimpleName());
        }
    }

    private void recover(ModerationRepository.ReportWorkKey key, Map<UUID, ModerationRepository.ReportWorkKey> legacyBatch) {
        var authority = repository.reportWorkAuthority(key);
        if (authority == null) return;
        if (ModerationRepository.CREATE_WORK.equals(key.previousStatus())) {
            var report = authority.report();
            events.recoverReportCreation(report.createdAtKey(), report.reportId(), report.reporterId(), report.conversationId(),
                    report.targetUserId(), report.reasonCode(), report.targetType());
            repository.removeReportWork(key);
            return;
        }
        if (authority.intent().isEmpty()) return;
        var intent = authority.intent();
        if ("true".equals(intent.get("enqueued"))) {
            repository.removeReportWork(key);
            return;
        }
        boolean recovered = "true".equals(intent.get("recovered"));
        boolean canEnqueue = ReportOutboxRoute.VERSION.equals(intent.get("outboxRoute"));
        boolean legacy = !intent.containsKey("outboxRoute");
        if (recovered && !canEnqueue) {
            if (legacy) reconcileLegacy(key, authority, legacyBatch);
            return;
        }
        var audit = auditEvent(key, authority);
        if (!recovered) {
            repository.replayReportProjection(key, authority);
            events.restoreReportAudit(audit);
        }
        if (canEnqueue) {
            events.enqueueRecoveredReport(audit);
            repository.markReportEnqueued(key);
        } else {
            repository.markReportAuditRecovered(key);
            if (legacy) reconcileLegacy(key, authority, legacyBatch);
        }
    }

    private void reconcileLegacy(ModerationRepository.ReportWorkKey key, ModerationRepository.ReportWorkAuthority authority,
                                 Map<UUID, ModerationRepository.ReportWorkKey> legacyBatch) {
        UUID id = UUID.fromString(authority.intent().get("id"));
        if (events.hasLegacyReportReceipt(id)) {
            repository.markReportEnqueued(key);
        } else if (outboxPublisher.isPresent()) {
            events.enqueueLegacyRecoveredReport(auditEvent(key, authority));
            legacyBatch.put(id, key);
        }
    }

    private CanonicalRoomAuditEvent auditEvent(ModerationRepository.ReportWorkKey key, ModerationRepository.ReportWorkAuthority authority) {
        var intent = authority.intent();
        var report = authority.report();
        UUID id = UUID.fromString(intent.get("id"));
        Instant at = Instant.ofEpochMilli(Uuids.unixTimestamp(id));
        return new CanonicalRoomAuditEvent(UUID.fromString(intent.get("actorId")), MONTH.format(at), id,
                "REPORT_STATUS_UPDATE", "report", report.reportId().toString(), report.conversationId(),
                report.targetUserId(), "SUCCESS", Objects.requireNonNull(intent.get("reason")),
                Map.of("status", key.previousStatus()),
                Map.of("status", intent.get("nextStatus"), "resolutionCode", intent.getOrDefault("resolutionCode", "")),
                null, null, null, at);
    }
}
