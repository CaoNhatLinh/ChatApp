package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class CassandraInviteRepository implements InviteRepository {
    private static final Duration RESOLUTION_LEASE = Duration.ofMinutes(2);

    private final CqlSession session;
    private final PreparedStatement createState;
    private final PreparedStatement createProjection;
    private final PreparedStatement listInvites;
    private final PreparedStatement listInvitesBefore;
    private final PreparedStatement loadInvite;
    private final PreparedStatement loadRecipient;
    private final PreparedStatement consumeUse;
    private final PreparedStatement reserveUse;
    private final PreparedStatement releaseUse;
    private final PreparedStatement createRecipient;
    private final PreparedStatement reclaimFailedRecipient;
    private final PreparedStatement updateRecipientStatus;
    private final PreparedStatement updateProjectionUseCount;
    private final PreparedStatement deactivateInvite;
    private final PreparedStatement recordJoinOutcome;
    private final PreparedStatement saveJoinRequest;
    private final PreparedStatement listRequests;
    private final PreparedStatement listRequestsBefore;
    private final PreparedStatement loadJoinRequest;
    private final PreparedStatement claimPendingResolution;
    private final PreparedStatement renewResolutionLease;
    private final PreparedStatement takeoverResolution;
    private final PreparedStatement finishResolution;

    public CassandraInviteRepository(CqlSession session) {
        this.session = session;
        this.createState = session.prepare("""
                UPDATE invite_state_by_token
                SET link_id = ?, conversation_id = ?, created_by = ?, created_at = ?, invite_kind = ?,
                    join_policy = ?, display_name = ?, expires_at = ?, is_active = ?, max_uses = ?, used_count = 0
                WHERE link_token = ?
                """);
        this.createProjection = session.prepare("""
                INSERT INTO invitation_links_by_conversation
                    (conversation_id, created_at, link_id, link_token, created_by, invite_kind,
                     join_policy, display_name, expires_at, is_active, max_uses, used_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """);
        this.listInvites = session.prepare(
                "SELECT * FROM invitation_links_by_conversation WHERE conversation_id = ? LIMIT ?");
        this.listInvitesBefore = session.prepare("""
                SELECT * FROM invitation_links_by_conversation
                WHERE conversation_id = ? AND created_at < ? LIMIT ?
                """);
        this.loadInvite = session.prepare(
                "SELECT * FROM invite_state_by_token WHERE link_token = ? LIMIT 1");
        this.loadRecipient = session.prepare(
                "SELECT * FROM invite_state_by_token WHERE link_token = ? AND recipient_id = ?");
        this.consumeUse = session.prepare("""
                BEGIN BATCH
                  UPDATE invite_state_by_token SET used_count = ?, is_active = ?
                  WHERE link_token = ? IF used_count = ? AND is_active = true;
                  INSERT INTO invite_state_by_token
                    (link_token, recipient_id, request_id, status, first_requested_at, updated_at)
                  VALUES (?, ?, ?, 'ACCEPTED', ?, ?) IF NOT EXISTS;
                APPLY BATCH
                """);
        this.reserveUse = session.prepare("""
                BEGIN BATCH
                  UPDATE invite_state_by_token SET used_count = ?, is_active = ?
                  WHERE link_token = ? IF used_count = ? AND is_active = true;
                  UPDATE invite_state_by_token SET status = 'ACCEPTED', updated_at = ?
                  WHERE link_token = ? AND recipient_id = ? IF status = 'PENDING';
                APPLY BATCH
                """);
        this.releaseUse = session.prepare("""
                BEGIN BATCH
                  UPDATE invite_state_by_token SET used_count = ?, is_active = ?
                  WHERE link_token = ? IF used_count = ?;
                  UPDATE invite_state_by_token SET status = 'FAILED', updated_at = ?
                  WHERE link_token = ? AND recipient_id = ? IF status = 'ACCEPTED';
                APPLY BATCH
                """);
        this.createRecipient = session.prepare("""
                INSERT INTO invite_state_by_token
                    (link_token, recipient_id, request_id, requested_at, status, first_requested_at, updated_at)
                VALUES (?, ?, ?, ?, 'PENDING', ?, ?) IF NOT EXISTS
                """);
        this.reclaimFailedRecipient = session.prepare("""
                UPDATE invite_state_by_token
                SET request_id = ?, requested_at = ?, status = 'PENDING', first_requested_at = ?, updated_at = ?
                WHERE link_token = ? AND recipient_id = ? IF status = 'FAILED'
                """);
        this.updateRecipientStatus = session.prepare("""
                UPDATE invite_state_by_token SET status = ?, updated_at = ?
                WHERE link_token = ? AND recipient_id = ?
                """);
        this.updateProjectionUseCount = session.prepare("""
                UPDATE invitation_links_by_conversation SET used_count = ?, is_active = ?
                WHERE conversation_id = ? AND created_at = ? AND link_id = ?
                """);
        this.deactivateInvite = session.prepare("""
                UPDATE invite_state_by_token
                SET is_active = false, revoked_by = ?, revoked_at = ? WHERE link_token = ?
                """);
        this.recordJoinOutcome = session.prepare("""
                INSERT INTO invitation_joins_by_link
                    (link_id, joined_at, user_id, outcome, ip_hash)
                VALUES (?, now(), ?, ?, ?)
                """);
        this.saveJoinRequest = session.prepare("""
                INSERT INTO join_requests_by_conversation
                    (conversation_id, requested_at, request_id, user_id, link_id, link_token, status)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING') IF NOT EXISTS
                """);
        this.listRequests = session.prepare(
                "SELECT * FROM join_requests_by_conversation WHERE conversation_id = ? LIMIT ?");
        this.listRequestsBefore = session.prepare("""
                SELECT * FROM join_requests_by_conversation
                WHERE conversation_id = ? AND requested_at < ? LIMIT ?
                """);
        this.loadJoinRequest = session.prepare("""
                SELECT * FROM join_requests_by_conversation
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                """);
        this.claimPendingResolution = session.prepare("""
                UPDATE join_requests_by_conversation
                SET status = 'APPROVING', resolution_decision = ?, resolved_by = ?,
                    resolved_at = ?, resolution_lease_until = ?
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ? IF status = 'PENDING'
                """);
        this.renewResolutionLease = session.prepare("""
                UPDATE join_requests_by_conversation SET resolved_at = ?, resolution_lease_until = ?
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                IF status = 'APPROVING' AND resolved_by = ? AND resolution_decision = ?
                   AND resolution_lease_until = ?
                """);
        this.takeoverResolution = session.prepare("""
                UPDATE join_requests_by_conversation
                SET resolution_decision = ?, resolved_by = ?, resolved_at = ?, resolution_lease_until = ?
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                IF status = 'APPROVING' AND resolved_by = ? AND resolution_lease_until = ?
                   AND resolution_decision = ?
                """);
        this.finishResolution = session.prepare("""
                UPDATE join_requests_by_conversation
                SET status = ?, resolved_by = ?, resolved_at = ?, resolution_lease_until = null
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                IF status = 'APPROVING' AND resolved_by = ?
                """);
    }

    @Override
    public void create(CanonicalInviteLink invite) {
        session.execute(createState.bind(
                invite.linkId(), invite.conversationId(), invite.createdBy(),
                invite.createdAt(), invite.inviteKind(), invite.joinPolicy(), invite.displayName(),
                invite.expiresAt(), invite.isActive(), invite.maxUses(), invite.linkToken()));
        session.execute(createProjection.bind(
                invite.conversationId(), invite.linkId(), invite.linkId(), invite.linkToken(),
                invite.createdBy(), invite.inviteKind(), invite.joinPolicy(), invite.displayName(),
                invite.expiresAt(), invite.isActive(), invite.maxUses()));
    }

    @Override
    public InvitePage listByConversation(UUID conversationId, UUID before, int limit) {
        List<CanonicalInviteLink> loaded = session.execute(before == null
                        ? listInvites.bind(conversationId, limit + 1)
                        : listInvitesBefore.bind(conversationId, before, limit + 1))
                .all().stream().map(this::mapInvite).map(this::withComputedAvailability).toList();
        boolean hasNext = loaded.size() > limit;
        List<CanonicalInviteLink> content = loaded.subList(0, Math.min(limit, loaded.size()));
        UUID nextCursor = hasNext && !content.isEmpty() ? content.get(content.size() - 1).linkId() : null;
        return new InvitePage(content, nextCursor, hasNext);
    }

    @Override
    public CanonicalInviteLink findByToken(String token) {
        Row row = session.execute(loadInvite.bind(token)).one();
        return row == null ? null : withComputedAvailability(mapInvite(row));
    }

    @Override
    public String findViewerStatus(CanonicalInviteLink invite, UUID userId) {
        Row row = recipient(invite.linkToken(), userId);
        return row == null ? null : row.getString("status");
    }

    @Override
    public ConsumeResult consume(String token, UUID userId) {
        CanonicalInviteLink invite = findByToken(token);
        if (invite == null || !Boolean.TRUE.equals(invite.isActive())) {
            return ConsumeResult.RETRY_REQUIRED;
        }
        Row existing = recipient(token, userId);
        if (existing != null) {
            return "ACCEPTED".equals(existing.getString("status"))
                    ? ConsumeResult.ALREADY_ACCEPTED : ConsumeResult.RETRY_REQUIRED;
        }
        int current = count(invite.usedCount());
        if (invite.maxUses() != null && current >= invite.maxUses()) {
            deactivate(invite, userId);
            return ConsumeResult.RETRY_REQUIRED;
        }
        int next = current + 1;
        boolean active = invite.maxUses() == null || next < invite.maxUses();
        Instant now = Instant.now();
        boolean applied = session.execute(consumeUse.bind(
                next, active, token, current,
                token, userId, Uuids.timeBased(), now, now)).wasApplied();
        if (!applied) {
            Row concurrent = recipient(token, userId);
            return concurrent != null && "ACCEPTED".equals(concurrent.getString("status"))
                    ? ConsumeResult.ALREADY_ACCEPTED : ConsumeResult.RETRY_REQUIRED;
        }
        updateProjection(invite, next, active);
        recordOutcome(invite, userId, "ACCEPTED");
        return ConsumeResult.CONSUMED;
    }

    @Override
    public String requestApproval(CanonicalInviteLink invite, UUID userId) {
        Row existing = recipient(invite.linkToken(), userId);
        if (existing != null && "PENDING".equals(existing.getString("status"))) {
            ensureRequestProjection(invite, userId, existing);
            return "PENDING";
        }
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = Uuids.timeBased();
        Instant now = Instant.now();
        boolean claimed = session.execute(createRecipient.bind(
                invite.linkToken(), userId, requestId, requestedAt, now, now)).wasApplied();
        if (!claimed) {
            claimed = session.execute(reclaimFailedRecipient.bind(
                    requestId, requestedAt, now, now, invite.linkToken(), userId)).wasApplied();
        }
        Row current = recipient(invite.linkToken(), userId);
        if (!claimed && (current == null || !"PENDING".equals(current.getString("status")))) {
            return current == null ? "FAILED" : current.getString("status");
        }
        ensureRequestProjection(invite, userId, current);
        recordOutcome(invite, userId, "PENDING");
        return "PENDING";
    }

    @Override
    public void recordOutcome(CanonicalInviteLink invite, UUID userId, String outcome) {
        session.execute(recordJoinOutcome.bind(invite.linkId(), userId, outcome, null));
    }

    @Override
    public boolean decline(CanonicalInviteLink invite, UUID userId) {
        Row existing = recipient(invite.linkToken(), userId);
        if (existing != null && "ACCEPTED".equals(existing.getString("status"))) {
            return false;
        }
        Instant now = Instant.now();
        if (existing == null) {
            boolean created = session.execute(createRecipient.bind(
                    invite.linkToken(), userId, UUID.randomUUID(), Uuids.timeBased(), now, now)).wasApplied();
            if (!created) {
                return false;
            }
        }
        session.execute(updateRecipientStatus.bind("DECLINED", now, invite.linkToken(), userId));
        recordOutcome(invite, userId, "DECLINED");
        return true;
    }

    @Override
    public List<CanonicalApiContracts.JoinRequestView> listRequests(UUID conversationId, UUID before, int limit) {
        return session.execute(before == null
                        ? listRequests.bind(conversationId, limit)
                        : listRequestsBefore.bind(conversationId, before, limit)).all().stream()
                .map(row -> new CanonicalApiContracts.JoinRequestView(
                        row.getUuid("conversation_id"), row.getUuid("requested_at"), row.getUuid("request_id"),
                        row.getUuid("user_id"), row.getUuid("link_id"), row.getString("status"),
                        row.getUuid("resolved_by"), row.getInstant("resolved_at")))
                .toList();
    }

    @Override
    public InviteJoinRequest findRequest(UUID conversationId, UUID requestedAt, UUID requestId) {
        Row row = session.execute(loadJoinRequest.bind(conversationId, requestedAt, requestId)).one();
        return row == null ? null : new InviteJoinRequest(
                row.getString("status"), row.getString("resolution_decision"), row.getUuid("resolved_by"),
                row.getUuid("user_id"), row.getUuid("link_id"), row.getString("link_token"),
                row.getInstant("resolved_at"));
    }

    @Override
    public boolean claimResolution(
            UUID conversationId, UUID requestedAt, UUID requestId, UUID actorId, String decision) {
        Instant now = Instant.now();
        Instant leaseUntil = now.plus(RESOLUTION_LEASE);
        if (session.execute(claimPendingResolution.bind(
                decision, actorId, now, leaseUntil, conversationId, requestedAt, requestId)).wasApplied()) {
            return true;
        }
        Row row = session.execute(loadJoinRequest.bind(conversationId, requestedAt, requestId)).one();
        if (row == null || !"APPROVING".equals(row.getString("status"))) {
            return false;
        }
        UUID owner = row.getUuid("resolved_by");
        String activeDecision = row.getString("resolution_decision");
        if (!decision.equals(activeDecision)) return false;
        Instant lease = row.getInstant("resolution_lease_until");
        if (actorId.equals(owner) && decision.equals(activeDecision)) {
            return session.execute(renewResolutionLease.bind(
                    now, leaseUntil, conversationId, requestedAt, requestId,
                    owner, activeDecision, lease)).wasApplied();
        }
        if (lease == null || !lease.isAfter(now)) {
            return session.execute(takeoverResolution.bind(
                    decision, actorId, now, leaseUntil, conversationId, requestedAt, requestId,
                    owner, lease, activeDecision)).wasApplied();
        }
        return false;
    }

    @Override
    public void finishResolution(
            UUID conversationId, UUID requestedAt, UUID requestId, String status, UUID actorId) {
        if (!session.execute(finishResolution.bind(
                status, actorId, Instant.now(), conversationId, requestedAt, requestId, actorId)).wasApplied()) {
            throw new ConflictException("join request changed concurrently");
        }
    }

    @Override
    public boolean reserveUse(CanonicalInviteLink invite, UUID userId) {
        int current = count(invite.usedCount());
        if (invite.maxUses() != null && current >= invite.maxUses()) {
            return false;
        }
        int next = current + 1;
        boolean active = invite.maxUses() == null || next < invite.maxUses();
        Instant now = Instant.now();
        boolean applied = session.execute(reserveUse.bind(
                next, active, invite.linkToken(), current,
                now, invite.linkToken(), userId)).wasApplied();
        if (applied) {
            updateProjection(invite, next, active);
            recordOutcome(invite, userId, "ACCEPTED");
        }
        return applied;
    }

    @Override
    public void releaseUse(CanonicalInviteLink invite, UUID userId) {
        for (int attempt = 0; attempt < 5; attempt++) {
            CanonicalInviteLink current = findByToken(invite.linkToken());
            int used = current == null ? 0 : count(current.usedCount());
            if (current == null || used == 0) {
                markFailed(invite, userId);
                return;
            }
            int next = used - 1;
            boolean active = current.revokedAt() == null
                    && (current.expiresAt() == null || current.expiresAt().isAfter(Instant.now()))
                    && (current.maxUses() == null || next < current.maxUses());
            Instant now = Instant.now();
            boolean applied = session.execute(releaseUse.bind(
                    next, active, current.linkToken(), used,
                    now, current.linkToken(), userId)).wasApplied();
            if (applied) {
                updateProjection(current, next, active);
                return;
            }
        }
        throw new IllegalStateException("invite use release needs reconciliation");
    }

    @Override
    public void markFailed(CanonicalInviteLink invite, UUID userId) {
        session.execute(updateRecipientStatus.bind("FAILED", Instant.now(), invite.linkToken(), userId));
    }

    @Override
    public void revoke(CanonicalInviteLink invite, UUID actorId) {
        deactivate(invite, actorId);
    }

    private Row recipient(String token, UUID userId) {
        return session.execute(loadRecipient.bind(token, userId)).one();
    }

    private void ensureRequestProjection(CanonicalInviteLink invite, UUID userId, Row recipient) {
        if (recipient == null) {
            throw new IllegalStateException("invite recipient claim is missing");
        }
        UUID requestId = recipient.getUuid("request_id");
        UUID requestedAt = recipient.getUuid("requested_at");
        if (requestId == null || requestedAt == null) {
            throw new IllegalStateException("invite recipient claim has no request identity");
        }
        session.execute(saveJoinRequest.bind(
                invite.conversationId(), requestedAt, requestId, userId,
                invite.linkId(), invite.linkToken()));
    }

    private void updateProjection(CanonicalInviteLink invite, int usedCount, boolean active) {
        session.execute(updateProjectionUseCount.bind(
                usedCount, active, invite.conversationId(), invite.linkId(), invite.linkId()));
    }

    private void deactivate(CanonicalInviteLink invite, UUID actorId) {
        Instant now = Instant.now();
        session.execute(deactivateInvite.bind(actorId, now, invite.linkToken()));
        updateProjection(invite, count(invite.usedCount()), false);
    }

    private CanonicalInviteLink withComputedAvailability(CanonicalInviteLink invite) {
        boolean expired = invite.expiresAt() != null && !invite.expiresAt().isAfter(Instant.now());
        boolean exhausted = invite.maxUses() != null && count(invite.usedCount()) >= invite.maxUses();
        if (!expired && !exhausted) {
            return invite;
        }
        return new CanonicalInviteLink(
                invite.linkId(), invite.linkToken(), invite.conversationId(), invite.createdBy(),
                invite.createdAt(), invite.inviteKind(), invite.joinPolicy(), invite.displayName(),
                invite.expiresAt(), false, invite.maxUses(), invite.usedCount(),
                invite.revokedBy(), invite.revokedAt());
    }

    private CanonicalInviteLink mapInvite(Row row) {
        return new CanonicalInviteLink(
                row.getUuid("link_id"), row.getString("link_token"), row.getUuid("conversation_id"),
                row.getUuid("created_by"), createdAt(row), row.getString("invite_kind"),
                row.getString("join_policy"), row.getString("display_name"), row.getInstant("expires_at"),
                row.getBoolean("is_active"), nullableInt(row, "max_uses"), nullableInt(row, "used_count"),
                row.getUuid("revoked_by"), row.getInstant("revoked_at"));
    }

    private Instant createdAt(Row row) {
        Object raw = row.getObject("created_at");
        if (raw instanceof UUID timeUuid) {
            return Instant.ofEpochMilli(Uuids.unixTimestamp(timeUuid));
        }
        return row.getInstant("created_at");
    }

    private Integer nullableInt(Row row, String column) {
        return row.isNull(column) ? null : row.getInt(column);
    }

    private int count(Integer value) {
        return value == null ? 0 : value;
    }
}
