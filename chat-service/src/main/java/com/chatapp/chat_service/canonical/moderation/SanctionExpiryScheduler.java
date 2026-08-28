package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Applies timed sanctions without scanning the user partition. The expiry
 * projection is bounded by UTC day and the status claim is conditional, so
 * multiple application instances can safely run this job.
 */
@Component
public class SanctionExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(SanctionExpiryScheduler.class);

    private final ModerationRepository repository;
    private final CanonicalCqlStore store;
    private final CanonicalEventRecorder events;
    private final int lookbackDays;
    private final int batchSize;

    public SanctionExpiryScheduler(
            ModerationRepository repository,
            CanonicalCqlStore store,
            CanonicalEventRecorder events,
            @Value("${app.moderation.expiry-lookback-days:31}") int lookbackDays,
            @Value("${app.moderation.expiry-batch-size:100}") int batchSize) {
        this.repository = repository;
        this.store = store;
        this.events = events;
        this.lookbackDays = Math.max(1, Math.min(31, lookbackDays));
        this.batchSize = Math.max(1, Math.min(200, batchSize));
    }

    @Scheduled(fixedDelayString = "${app.moderation.expiry-poll-delay-ms:60000}")
    public void expireDueSanctions() {
        Instant now = Instant.now();
        List<ModerationRepository.SanctionRow> due = repository.listDueSanctions(now, lookbackDays, batchSize);
        for (ModerationRepository.SanctionRow sanction : due) {
            if (!"ACTIVE".equals(sanction.status())
                    || sanction.expiresAt() == null
                    || sanction.expiresAt().isAfter(now)) {
                continue;
            }
            if (!repository.isSanctionActive(sanction)) {
                // The expiry projection can briefly lag a revoke. The source
                // sanction row remains authoritative for this decision.
                continue;
            }

            try {
                applyExpirationSideEffect(sanction, now);
                if (repository.markSanctionExpired(sanction)) {
                    events.record(null, sanction.conversationId(), "SANCTION_EXPIRED", "user_sanction",
                            sanction.sanctionId().toString(), sanction.userId(), "SANCTION_EXPIRED",
                            Map.of("status", "ACTIVE"), Map.of("status", "EXPIRED"),
                            Map.of("scope", sanction.scope(), "sanctionType", sanction.sanctionType()));
                }
            } catch (RuntimeException exception) {
                // Keep the projection ACTIVE when side effects fail so the next
                // bounded poll can retry instead of silently losing enforcement.
                log.warn("Could not expire sanction {}", sanction.sanctionId(), exception);
            }
        }
    }

    private void applyExpirationSideEffect(ModerationRepository.SanctionRow sanction, Instant now) {
        if ("APP".equals(sanction.scope())) {
            expireAppSanction(sanction, now);
            return;
        }

        if (sanction.conversationId() == null) return;
        if ("BAN".equals(sanction.sanctionType()) || "SUSPEND".equals(sanction.sanctionType())) {
            // The expiry-qualified CAS leaves an overlapping later ban intact.
            store.clearConversationBanIfExpiresAt(
                    sanction.conversationId(), sanction.userId(), sanction.expiresAt());
        } else if ("MUTE".equals(sanction.sanctionType())) {
            CanonicalConversationMember member = store.findConversationMember(
                    sanction.conversationId(), sanction.userId());
            if (member != null && member.mutedUntil() != null && !member.mutedUntil().isAfter(now)) {
                // A CAS prevents a newer mute from being cleared by this delayed run.
                store.clearMemberMuteIfExpiresAt(
                        sanction.conversationId(), sanction.userId(), member.mutedUntil());
            }
        }
    }

    private void expireAppSanction(ModerationRepository.SanctionRow sanction, Instant now) {
        if (!"BAN".equals(sanction.sanctionType()) && !"SUSPEND".equals(sanction.sanctionType())) return;
        // Do not restore an account while another timed app sanction is active.
        if (repository.hasActiveAppAccountLock(sanction.userId(), now)) return;
        CanonicalUser current = store.findUserById(sanction.userId());
        if (current == null) return;
        String expectedStatus = "BAN".equals(sanction.sanctionType()) ? "BANNED" : "SUSPENDED";
        if (expectedStatus.equalsIgnoreCase(current.accountStatus())) {
            store.updateUserAccountStatus(sanction.userId(), "ACTIVE", now);
        }
    }
}
