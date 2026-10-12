package com.chatapp.chat_service.canonical.repository;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.community.CommunityDirectoryFilter;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchStatementBuilder;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.data.UdtValue;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.time.Instant;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

@Repository
public class CanonicalCqlStore {

    private final CqlSession session;
    private final UserDefinedType messageSummaryType;

    private final PreparedStatement lookupDmPair;
    private final PreparedStatement saveDmPair;
    private final PreparedStatement saveConversation;
    private final PreparedStatement updateConversationChatPolicy;
    private final PreparedStatement updateConversationNotificationPolicy;
    private final PreparedStatement updateConversationLastMessage;
    private final PreparedStatement loadConversation;
    private final PreparedStatement saveCommunityDirectoryEntry;
    private final PreparedStatement listCommunityDirectory;
    private final PreparedStatement listCommunityDirectoryAfter;
    private final PreparedStatement claimCommunityJoinRequest;
    private final PreparedStatement loadCommunityJoinClaim;
    private final PreparedStatement saveCommunityJoinRequestProjection;
    private final PreparedStatement listCommunityJoinRequests;
    private final PreparedStatement listCommunityJoinRequestsBefore;
    private final PreparedStatement replaceCommunityJoinRequest;
    private final PreparedStatement claimCommunityJoinResolution;
    private final PreparedStatement renewCommunityJoinResolution;
    private final PreparedStatement takeoverCommunityJoinResolution;
    private final PreparedStatement updateCommunityJoinClaim;
    private final PreparedStatement saveConversationMember;
    private final PreparedStatement insertConversationMemberIfAbsent;
    private final PreparedStatement initializeConversationMembership;
    private final PreparedStatement loadConversationMembership;
    private final PreparedStatement updateConversationMemberCount;
    private final PreparedStatement decrementConversationMemberCount;
    private final PreparedStatement deleteConversationMember;
    private final PreparedStatement transferCurrentOwnerRoles;
    private final PreparedStatement transferNextOwnerRoles;
    private final PreparedStatement transferConversationOwner;
    private final PreparedStatement loadConversationMember;
    private final PreparedStatement listConversationMembers;
    private final PreparedStatement listConversationMembersAfter;
    private final PreparedStatement updateMemberChatPolicy;
    private final PreparedStatement updateMemberNotificationPolicy;
    private final PreparedStatement saveConversationProjection;
    private final PreparedStatement updateConversationProjectionRoles;
    private final PreparedStatement updateMemberRolesIfUnchanged;
    private final PreparedStatement advanceConversationRoleRevision;
    private final PreparedStatement updateConversationProjectionNotification;
    private final PreparedStatement listConversationsByUser;
    private final PreparedStatement listConversationsByUserAfter;
    private final PreparedStatement listUnpinnedConversationsByUser;
    private final PreparedStatement deleteConversationProjection;
    private final PreparedStatement pinConversationSlot;
    private final PreparedStatement unpinConversationSlot;
    private final PreparedStatement listPinSlots;
    private final PreparedStatement queryConversationProjectionPinned;
    private final PreparedStatement queryConversationProjectionAny;

    public CanonicalCqlStore(CqlSession session) {
        this.session = session;
        this.messageSummaryType = session.getMetadata()
                .getKeyspace("chat_app")
                .flatMap(ks -> ks.getUserDefinedType("message_summary"))
                .orElseThrow(() -> new IllegalStateException("Missing UDT message_summary"));

        this.lookupDmPair = session.prepare("""
                SELECT conversation_id FROM dm_conversation_by_pair WHERE participant_pair_key = ?
                """);
        this.saveDmPair = session.prepare("""
                INSERT INTO dm_conversation_by_pair (participant_pair_key, conversation_id, created_at)
                VALUES (?, ?, ?) IF NOT EXISTS
                """);

        this.saveConversation = session.prepare("""
                INSERT INTO conversations_by_id (
                    conversation_id, conversation_type, visibility, join_policy, name, name_normalized,
                    description, avatar_url, avatar_asset_id, created_by, created_at, updated_at, is_deleted,
                    deleted_at, chat_mode, slow_mode_seconds, message_retention_days, default_notification_level,
                    category_id, community_tags, language_code, last_message, last_activity_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.loadConversation = session.prepare("SELECT * FROM conversations_by_id WHERE conversation_id = ?");
        this.saveCommunityDirectoryEntry = session.prepare("""
                INSERT INTO community_directory_by_filter
                    (discovery_filter, discovery_shard, name_normalized, conversation_id, last_activity_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listCommunityDirectory = session.prepare("""
                SELECT name_normalized, conversation_id FROM community_directory_by_filter
                WHERE discovery_filter = ? AND discovery_shard = ? AND name_normalized >= ? LIMIT ?
                """);
        this.listCommunityDirectoryAfter = session.prepare("""
                SELECT name_normalized, conversation_id FROM community_directory_by_filter
                WHERE discovery_filter = ? AND discovery_shard = ?
                  AND (name_normalized, conversation_id) > (?, ?) LIMIT ?
                """);
        this.claimCommunityJoinRequest = session.prepare("""
                INSERT INTO community_join_request_by_user
                    (conversation_id, user_id, request_id, status, requested_at, reason, updated_at)
                VALUES (?, ?, ?, 'PENDING', ?, ?, ?) IF NOT EXISTS
                """);
        this.loadCommunityJoinClaim = session.prepare("""
                SELECT * FROM community_join_request_by_user
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.saveCommunityJoinRequestProjection = session.prepare("""
                INSERT INTO community_join_requests_by_conversation
                    (conversation_id, requested_at, request_id, user_id, status, reason,
                     resolution_decision, resolved_by, resolved_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listCommunityJoinRequests = session.prepare("""
                SELECT * FROM community_join_requests_by_conversation
                WHERE conversation_id = ? LIMIT ?
                """);
        this.listCommunityJoinRequestsBefore = session.prepare("""
                SELECT * FROM community_join_requests_by_conversation
                WHERE conversation_id = ? AND requested_at < ? LIMIT ?
                """);
        this.replaceCommunityJoinRequest = session.prepare("""
                UPDATE community_join_request_by_user
                SET request_id = ?, status = 'PENDING', requested_at = ?, reason = ?,
                    resolution_decision = null, resolved_by = null, resolved_at = null, updated_at = ?
                WHERE conversation_id = ? AND user_id = ? IF request_id = ?
                """);
        this.claimCommunityJoinResolution = session.prepare("""
                UPDATE community_join_request_by_user
                SET status = 'APPROVING', resolution_decision = ?, resolved_by = ?, resolved_at = ?,
                    resolution_lease_until = ?, updated_at = ?
                WHERE conversation_id = ? AND user_id = ? IF request_id = ? AND status = 'PENDING'
                """);
        this.renewCommunityJoinResolution = session.prepare("""
                UPDATE community_join_request_by_user
                SET resolved_at = ?, resolution_lease_until = ?, updated_at = ?
                WHERE conversation_id = ? AND user_id = ?
                IF request_id = ? AND status = 'APPROVING' AND resolved_by = ?
                   AND resolution_decision = ? AND resolution_lease_until = ?
                """);
        this.takeoverCommunityJoinResolution = session.prepare("""
                UPDATE community_join_request_by_user
                SET resolution_decision = ?, resolved_by = ?, resolved_at = ?,
                    resolution_lease_until = ?, updated_at = ?
                WHERE conversation_id = ? AND user_id = ?
                IF request_id = ? AND status = 'APPROVING' AND resolved_by = ?
                   AND resolution_lease_until = ? AND resolution_decision = ?
                """);
        this.updateCommunityJoinClaim = session.prepare("""
                UPDATE community_join_request_by_user
                SET status = ?, resolved_by = ?, resolved_at = ?, resolution_lease_until = null, updated_at = ?
                WHERE conversation_id = ? AND user_id = ? IF request_id = ? AND status = 'APPROVING'
                   AND resolved_by = ?
                """);
        this.updateConversationChatPolicy = session.prepare("""
                UPDATE conversations_by_id SET chat_mode = ?, slow_mode_seconds = ?, updated_at = ?
                WHERE conversation_id = ?
                """);
        this.updateConversationNotificationPolicy = session.prepare("""
                UPDATE conversations_by_id SET default_notification_level = ?, updated_at = ?
                WHERE conversation_id = ?
                """);
        this.updateConversationLastMessage = session.prepare("""
                UPDATE conversations_by_id
                SET last_message = ?, last_activity_at = ?, updated_at = ?
                WHERE conversation_id = ?
                """);
        this.saveConversationMember = session.prepare("""
                INSERT INTO conversation_members_by_conversation
                    (conversation_id, user_id, role_ids, joined_at, invited_by, muted_until,
                     message_interval_seconds, notification_override, last_read_message_id, last_read_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.insertConversationMemberIfAbsent = session.prepare("""
                INSERT INTO conversation_members_by_conversation
                    (conversation_id, user_id, role_ids, joined_at, invited_by, muted_until,
                     message_interval_seconds, notification_override, last_read_message_id, last_read_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.initializeConversationMembership = session.prepare("""
                UPDATE conversation_members_by_conversation
                SET member_count = ?, max_members = ?, owner_id = ?, owner_updated_at = ?, role_revision = ?
                WHERE conversation_id = ?
                """);
        this.loadConversationMembership = session.prepare("""
                SELECT member_count, max_members, owner_id, owner_updated_at, role_revision
                FROM conversation_members_by_conversation
                WHERE conversation_id = ? LIMIT 1
                """);
        this.updateConversationMemberCount = session.prepare("""
                UPDATE conversation_members_by_conversation SET member_count = ?
                WHERE conversation_id = ? IF member_count = ?
                """);
        this.decrementConversationMemberCount = session.prepare("""
                UPDATE conversation_members_by_conversation SET member_count = ?
                WHERE conversation_id = ? IF member_count = ? AND owner_id != ?
                """);
        this.deleteConversationMember = session.prepare("""
                DELETE FROM conversation_members_by_conversation
                WHERE conversation_id = ? AND user_id = ? IF EXISTS
                """);
        this.transferCurrentOwnerRoles = session.prepare("""
                UPDATE conversation_members_by_conversation SET role_ids = ?
                WHERE conversation_id = ? AND user_id = ? IF role_ids = ?
                """);
        this.transferNextOwnerRoles = session.prepare("""
                UPDATE conversation_members_by_conversation SET role_ids = ?
                WHERE conversation_id = ? AND user_id = ? IF role_ids = ?
                """);
        this.transferConversationOwner = session.prepare("""
                UPDATE conversation_members_by_conversation SET owner_id = ?, owner_updated_at = ?
                WHERE conversation_id = ? IF owner_id = ? AND role_revision = ?
                """);
        this.loadConversationMember = session.prepare("""
                SELECT * FROM conversation_members_by_conversation
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.listConversationMembers = session.prepare("""
                SELECT * FROM conversation_members_by_conversation
                WHERE conversation_id = ? LIMIT ?
                """);
        this.listConversationMembersAfter = session.prepare("""
                SELECT * FROM conversation_members_by_conversation
                WHERE conversation_id = ? AND user_id > ? LIMIT ?
                """);
        this.updateMemberChatPolicy = session.prepare("""
                UPDATE conversation_members_by_conversation
                SET muted_until = ?, message_interval_seconds = ?
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.updateMemberNotificationPolicy = session.prepare("""
                UPDATE conversation_members_by_conversation
                SET notification_override = ?
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.saveConversationProjection = session.prepare("""
                INSERT INTO conversations_by_user
                    (user_id, is_pinned, last_activity_at, conversation_id, conversation_type, visibility,
                     role_ids, joined_at, last_message, unread_count, notification_override)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.updateConversationProjectionRoles = session.prepare("""
                UPDATE conversations_by_user SET role_ids = ?
                WHERE user_id = ? AND is_pinned = ? AND last_activity_at = ? AND conversation_id = ?
                """);
        this.updateMemberRolesIfUnchanged = session.prepare("""
                UPDATE conversation_members_by_conversation SET role_ids = ?
                WHERE conversation_id = ? AND user_id = ? IF role_ids = ? AND role_revision = ?
                """);
        this.advanceConversationRoleRevision = session.prepare("""
                UPDATE conversation_members_by_conversation SET role_revision = ?
                WHERE conversation_id = ? IF role_revision = ?
                """);
        this.updateConversationProjectionNotification = session.prepare("""
                UPDATE conversations_by_user SET notification_override = ?
                WHERE user_id = ? AND is_pinned = ? AND last_activity_at = ? AND conversation_id = ?
                """);
        this.listConversationsByUser = session.prepare("""
                SELECT * FROM conversations_by_user
                WHERE user_id = ? AND is_pinned IN (true, false) LIMIT ?
                """);
        this.listConversationsByUserAfter = session.prepare("""
                SELECT * FROM conversations_by_user
                WHERE user_id = ? AND is_pinned = ?
                  AND (last_activity_at, conversation_id) < (?, ?)
                LIMIT ?
                """);
        this.listUnpinnedConversationsByUser = session.prepare("""
                SELECT * FROM conversations_by_user
                WHERE user_id = ? AND is_pinned = false LIMIT ?
                """);
        this.deleteConversationProjection = session.prepare("""
                DELETE FROM conversations_by_user
                WHERE user_id = ? AND is_pinned = ? AND last_activity_at = ? AND conversation_id = ?
                """);
        this.pinConversationSlot = session.prepare("""
                INSERT INTO pinned_conversation_slots_by_user (user_id, pin_slot, conversation_id, pinned_at)
                VALUES (?, ?, ?, now()) IF NOT EXISTS
                """);
        this.unpinConversationSlot = session.prepare("""
                DELETE FROM pinned_conversation_slots_by_user
                WHERE user_id = ? AND pin_slot = ?
                """);
        this.listPinSlots = session.prepare("""
                SELECT * FROM pinned_conversation_slots_by_user WHERE user_id = ?
                """);
        this.queryConversationProjectionPinned = session.prepare("""
                SELECT conversation_id, conversation_type, visibility, role_ids, joined_at, last_activity_at, notification_override, last_message, unread_count
                FROM conversations_by_user
                WHERE user_id = ? AND is_pinned = true
                """);
        this.queryConversationProjectionAny = session.prepare("""
                SELECT * FROM conversations_by_user WHERE user_id = ? AND is_pinned IN (true, false)
                """);
    }

    // -------- conversation --------
    public UUID findDmPair(String pairKey) {
        Row row = session.execute(lookupDmPair.bind(pairKey)).one();
        return row == null ? null : row.getUuid("conversation_id");
    }

    public UUID claimDmPair(String pairKey, UUID conversationId, Instant now) {
        var result = session.execute(saveDmPair.bind(pairKey, conversationId, now));
        if (result.wasApplied()) {
            return conversationId;
        }
        return findDmPair(pairKey);
    }

    public void saveConversation(CanonicalConversation conversation) {
        session.execute(saveConversation.bind(
                conversation.conversationId(),
                conversation.conversationType(),
                conversation.visibility(),
                conversation.joinPolicy(),
                conversation.name(),
                conversation.nameNormalized(),
                conversation.description(),
                conversation.avatarUrl(),
                conversation.avatarAssetId(),
                conversation.createdBy(),
                conversation.createdAt(),
                conversation.updatedAt(),
                Boolean.TRUE.equals(conversation.isDeleted()),
                conversation.deletedAt(),
                conversation.chatMode(),
                conversation.slowModeSeconds(),
                conversation.messageRetentionDays(),
                conversation.defaultNotificationLevel(),
                conversation.categoryId(),
                conversation.communityTags(),
                conversation.languageCode(),
                null,
                conversation.lastActivityAt()
        ));
    }

    public CanonicalConversation findConversation(UUID conversationId) {
        Row row = session.execute(loadConversation.bind(conversationId)).one();
        if (row == null) {
            return null;
        }
        return mapConversation(row, requireMembershipState(conversationId));
    }

    public void indexCommunityConversation(CanonicalConversation conversation) {
        if (!"COMMUNITY".equals(conversation.visibility()) || Boolean.TRUE.equals(conversation.isDeleted())) {
            return;
        }
        String language = CommunityDirectoryFilter.segment(conversation.languageCode(), "und");
        var filters = new java.util.LinkedHashSet<String>();
        filters.add(CommunityDirectoryFilter.selected(language, null, null));
        filters.add(CommunityDirectoryFilter.selected(language, conversation.categoryId(), null));
        conversation.communityTags().forEach(tag ->
                filters.add(CommunityDirectoryFilter.selected(language, null, tag)));
        byte shard = (byte) ((conversation.conversationId().hashCode() & Integer.MAX_VALUE) % 16);
        filters.forEach(filter -> session.execute(saveCommunityDirectoryEntry.bind(
                filter, shard, conversation.nameNormalized(), conversation.conversationId(),
                conversation.lastActivityAt())));
    }

    public List<CommunityDirectoryKey> listCommunityDirectory(
            String discoveryFilter,
            String namePrefix,
            String afterName,
            UUID afterConversationId,
            int requestedLimit) {
        if ((afterName == null) != (afterConversationId == null)) {
            throw new IllegalArgumentException("community cursor requires both name and conversation id");
        }
        int limit = Math.max(1, Math.min(51, requestedLimit));
        List<CommunityDirectoryKey> rows = new ArrayList<>(limit * 16);
        for (byte shard = 0; shard < 16; shard++) {
            var result = afterName == null
                    ? session.execute(listCommunityDirectory.bind(discoveryFilter, shard, namePrefix, limit))
                    : session.execute(listCommunityDirectoryAfter.bind(
                            discoveryFilter, shard, afterName, afterConversationId, limit));
            result.all().stream()
                    .map(row -> new CommunityDirectoryKey(
                            row.getString("name_normalized"), row.getUuid("conversation_id")))
                    .filter(row -> row.nameNormalized().startsWith(namePrefix))
                    .forEach(rows::add);
        }
        return rows.stream()
                .sorted(Comparator.comparing(CommunityDirectoryKey::nameNormalized)
                        .thenComparing(CommunityDirectoryKey::conversationId))
                .limit(limit)
                .toList();
    }

    public CommunityJoinClaim requestCommunityApproval(UUID conversationId, UUID userId) {
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = Uuids.timeBased();
        Instant now = Instant.now();
        if (!session.execute(claimCommunityJoinRequest.bind(
                conversationId, userId, requestId, requestedAt, null, now)).wasApplied()) {
            Row current = session.execute(loadCommunityJoinClaim.bind(conversationId, userId)).one();
            if (current == null) {
                return new CommunityJoinClaim("RETRY_REQUIRED", false);
            }
            String status = current.getString("status");
            if (Set.of("APPROVED", "DECLINED", "FAILED").contains(status)) {
                if (session.execute(replaceCommunityJoinRequest.bind(
                        requestId, requestedAt, null, now, conversationId, userId,
                        current.getUuid("request_id"))).wasApplied()) {
                    saveCommunityJoinRequestProjection(new CommunityJoinRequestRow(
                            conversationId, userId, requestId, requestedAt,
                            "PENDING", null, null, null, null), now);
                    return new CommunityJoinClaim("PENDING", true);
                }
                return new CommunityJoinClaim("RETRY_REQUIRED", false);
            }
            saveCommunityJoinRequestProjection(mapCommunityJoinRequest(current), now);
            return new CommunityJoinClaim(status, false);
        }
        saveCommunityJoinRequestProjection(new CommunityJoinRequestRow(
                conversationId, userId, requestId, requestedAt,
                "PENDING", null, null, null, null), now);
        return new CommunityJoinClaim("PENDING", true);
    }

    public String findCommunityJoinStatus(UUID conversationId, UUID userId) {
        Row row = session.execute(loadCommunityJoinClaim.bind(conversationId, userId)).one();
        return row == null ? null : row.getString("status");
    }

    public CommunityJoinRequestRow findCommunityJoinRequest(UUID conversationId, UUID userId) {
        Row row = session.execute(loadCommunityJoinClaim.bind(conversationId, userId)).one();
        return row == null ? null : mapCommunityJoinRequest(row);
    }

    public List<CanonicalApiContracts.JoinRequestView> listCommunityJoinRequests(UUID conversationId, int limit) {
        return listCommunityJoinRequests(conversationId, null, limit);
    }

    public List<CanonicalApiContracts.JoinRequestView> listCommunityJoinRequests(
            UUID conversationId, UUID before, int limit) {
        return session.execute(before == null
                        ? listCommunityJoinRequests.bind(conversationId, limit)
                        : listCommunityJoinRequestsBefore.bind(conversationId, before, limit)).all().stream()
                .map(this::mapCommunityJoinRequest)
                .map(CommunityJoinRequestRow::toView)
                .toList();
    }

    public boolean claimCommunityJoinResolution(
            UUID conversationId, UUID userId, UUID requestId, UUID actorId, String decision) {
        Instant now = Instant.now();
        Instant leaseUntil = now.plus(Duration.ofMinutes(2));
        boolean applied = session.execute(claimCommunityJoinResolution.bind(
                decision, actorId, now, leaseUntil, now, conversationId, userId, requestId)).wasApplied();
        if (!applied) {
            Row current = session.execute(loadCommunityJoinClaim.bind(conversationId, userId)).one();
            if (current == null || !requestId.equals(current.getUuid("request_id"))
                    || !"APPROVING".equals(current.getString("status"))) {
                return false;
            }
            UUID owner = current.getUuid("resolved_by");
            String currentDecision = current.getString("resolution_decision");
            if (!decision.equals(currentDecision)) return false;
            Instant lease = current.getInstant("resolution_lease_until");
            if (actorId.equals(owner) && decision.equals(currentDecision)) {
                applied = session.execute(renewCommunityJoinResolution.bind(
                        now, leaseUntil, now, conversationId, userId, requestId,
                        owner, currentDecision, lease)).wasApplied();
            } else if (lease == null || !lease.isAfter(now)) {
                applied = session.execute(takeoverCommunityJoinResolution.bind(
                        decision, actorId, now, leaseUntil, now, conversationId, userId,
                        requestId, owner, lease, currentDecision)).wasApplied();
            }
        }
        if (applied) {
            CommunityJoinRequestRow claimed = findCommunityJoinRequest(conversationId, userId);
            if (claimed == null) {
                throw new IllegalStateException("claimed community join request is missing");
            }
            saveCommunityJoinRequestProjection(claimed, now);
        }
        return applied;
    }

    public void finishCommunityJoinResolution(
            UUID conversationId, UUID userId, UUID requestId, String status, UUID actorId) {
        Instant now = Instant.now();
        if (!session.execute(updateCommunityJoinClaim.bind(
                status, actorId, now, now, conversationId, userId, requestId, actorId)).wasApplied()) {
            throw new ConflictException("community join request changed concurrently");
        }
        CommunityJoinRequestRow finished = findCommunityJoinRequest(conversationId, userId);
        if (finished == null) {
            throw new IllegalStateException("finished community join request is missing");
        }
        saveCommunityJoinRequestProjection(finished, now);
    }

    private void saveCommunityJoinRequestProjection(CommunityJoinRequestRow request, Instant updatedAt) {
        session.execute(saveCommunityJoinRequestProjection.bind(
                request.conversationId(), request.requestedAt(), request.requestId(), request.userId(),
                request.status(), request.reason(), request.resolutionDecision(), request.resolvedBy(),
                request.resolvedAt(), updatedAt));
    }

    public void updateConversationChatPolicy(
            UUID conversationId, String chatMode, int slowModeSeconds, Instant updatedAt) {
        session.execute(updateConversationChatPolicy.bind(chatMode, slowModeSeconds, updatedAt, conversationId));
    }

    public void updateConversationNotificationPolicy(
            UUID conversationId, String defaultNotificationLevel, Instant updatedAt) {
        session.execute(updateConversationNotificationPolicy.bind(
                defaultNotificationLevel, updatedAt, conversationId));
    }

    public void updateLastMessageProjections(
            CanonicalMessage message,
            String senderDisplayName,
            List<ConversationMember> members) {
        String contentPreview = message.content() == null
                ? null
                : message.content().substring(0, Math.min(280, message.content().length()));
        UdtValue summary = messageSummaryType.newValue()
                .setUuid("message_id", message.messageId())
                .setUuid("sender_id", message.senderId())
                .setString("sender_display_name", senderDisplayName)
                .setString("content_preview", contentPreview)
                .setString("message_type", message.messageType())
                .setInstant("created_at", message.createdAt())
                .setBoolean("is_deleted", Boolean.TRUE.equals(message.isDeleted()))
                .setBoolean("has_attachments", Boolean.TRUE.equals(message.hasAttachments()));

        session.execute(updateConversationLastMessage.bind(
                summary, message.createdAt(), message.createdAt(), message.conversationId()));
        for (ConversationMember member : members) {
            Row old = findAnyConversationProjectionRow(member.userId(), message.conversationId());
            if (old == null) {
                continue;
            }
            boolean pinned = old.getBoolean("is_pinned");
            int unreadCount = member.userId().equals(message.senderId())
                    ? 0
                    : Math.max(0, old.getInt("unread_count")) + 1;
            session.execute(deleteConversationProjection.bind(
                    member.userId(), pinned, old.getInstant("last_activity_at"), message.conversationId()));
            session.execute(saveConversationProjection.bind(
                    member.userId(), pinned, message.createdAt(), message.conversationId(),
                    old.getString("conversation_type"), old.getString("visibility"),
                    old.getSet("role_ids", UUID.class), old.getInstant("joined_at"), summary,
                    unreadCount, old.getString("notification_override")));
        }
    }

    public void createConversationMembership(
            List<CanonicalConversationMember> members,
            int maxMembers,
            UUID ownerId,
            Instant ownerUpdatedAt) {
        if (members.isEmpty()) {
            throw new IllegalArgumentException("a conversation requires at least one member");
        }
        UUID conversationId = members.get(0).conversationId();
        if (members.stream().anyMatch(member -> !conversationId.equals(member.conversationId()))) {
            throw new IllegalArgumentException("initial members must share one conversation partition");
        }
        if (maxMembers < members.size()) {
            throw new IllegalArgumentException("initial members exceed maxMembers");
        }
        if (ownerId == null || ownerUpdatedAt == null
                || members.stream().noneMatch(member -> ownerId.equals(member.userId()))) {
            throw new IllegalArgumentException("conversation owner must be an initial member");
        }
        var batch = BatchStatement.builder(BatchType.LOGGED);
        members.forEach(member -> batch.addStatement(saveConversationMember.bind(
                member.conversationId(), member.userId(), member.roleIds(), member.joinedAt(),
                member.invitedBy(), member.mutedUntil(), member.messageIntervalSeconds(),
                member.notificationOverride(), member.lastReadMessageId(), member.lastReadAt())));
        batch.addStatement(initializeConversationMembership.bind(
                members.size(), maxMembers, ownerId, ownerUpdatedAt, 0L, conversationId));
        session.execute(batch.build());
    }

    public MembershipMutationResult tryAddConversationMember(CanonicalConversationMember member) {
        for (int attempt = 0; attempt < 5; attempt++) {
            MembershipState state = requireMembershipState(member.conversationId());
            if (state.memberCount() >= state.maxMembers()) {
                return MembershipMutationResult.CAPACITY_REACHED;
            }
            var batch = BatchStatement.builder(BatchType.LOGGED)
                    .addStatement(insertConversationMemberIfAbsent.bind(
                            member.conversationId(), member.userId(), member.roleIds(), member.joinedAt(),
                            member.invitedBy(), member.mutedUntil(), member.messageIntervalSeconds(),
                            member.notificationOverride(), member.lastReadMessageId(), member.lastReadAt()))
                    .addStatement(updateConversationMemberCount.bind(
                            state.memberCount() + 1, member.conversationId(), state.memberCount()))
                    .build();
            if (session.execute(batch).wasApplied()) {
                return MembershipMutationResult.ADDED;
            }
            if (findConversationMember(member.conversationId(), member.userId()) != null) {
                return MembershipMutationResult.ALREADY_MEMBER;
            }
        }
        throw new IllegalStateException("conversation membership changed concurrently; retry");
    }

    public MembershipMutationResult tryRemoveConversationMember(UUID conversationId, UUID userId) {
        for (int attempt = 0; attempt < 5; attempt++) {
            MembershipState state = requireMembershipState(conversationId);
            if (userId.equals(state.ownerId())) {
                return MembershipMutationResult.OWNER_PROTECTED;
            }
            if (state.memberCount() <= 1) {
                throw new IllegalStateException("conversation membership cannot fall below one owner");
            }
            var batch = BatchStatement.builder(BatchType.LOGGED)
                    .addStatement(deleteConversationMember.bind(conversationId, userId))
                    .addStatement(decrementConversationMemberCount.bind(
                            state.memberCount() - 1, conversationId, state.memberCount(), userId))
                    .build();
            if (session.execute(batch).wasApplied()) {
                deleteConversationMembershipProjection(userId, conversationId);
                return MembershipMutationResult.REMOVED;
            }
            if (findConversationMember(conversationId, userId) == null) {
                deleteConversationMembershipProjection(userId, conversationId);
                return MembershipMutationResult.NOT_MEMBER;
            }
        }
        throw new IllegalStateException("conversation membership changed concurrently; retry");
    }

    public MembershipState requireMembershipState(UUID conversationId) {
        Row row = session.execute(loadConversationMembership.bind(conversationId)).one();
        if (row == null || row.isNull("member_count") || row.isNull("max_members")
                || row.isNull("owner_id") || row.isNull("owner_updated_at") || row.isNull("role_revision")) {
            throw new IllegalStateException("conversation membership state is missing");
        }
        return new MembershipState(
                row.getInt("member_count"), row.getInt("max_members"), row.getUuid("owner_id"),
                row.getInstant("owner_updated_at"), row.getLong("role_revision"));
    }

    public OwnershipTransferResult transferConversationOwnership(
            UUID conversationId,
            long expectedRoleRevision,
            UUID currentOwnerId,
            UUID nextOwnerId,
            Set<UUID> currentOwnerRoleIds,
            Set<UUID> nextCurrentOwnerRoleIds,
            Set<UUID> nextOwnerRoleIds,
            Set<UUID> nextCurrentTargetRoleIds) {
        Instant transferredAt = Instant.now();
        var batch = BatchStatement.builder(BatchType.LOGGED)
                .addStatement(transferCurrentOwnerRoles.bind(
                        nextCurrentOwnerRoleIds, conversationId, currentOwnerId, currentOwnerRoleIds))
                .addStatement(transferNextOwnerRoles.bind(
                        nextCurrentTargetRoleIds, conversationId, nextOwnerId, nextOwnerRoleIds))
                .addStatement(transferConversationOwner.bind(
                        nextOwnerId, transferredAt, conversationId, currentOwnerId, expectedRoleRevision))
                .build();
        if (session.execute(batch).wasApplied()) {
            return OwnershipTransferResult.TRANSFERRED;
        }
        MembershipState state = requireMembershipState(conversationId);
        return nextOwnerId.equals(state.ownerId())
                ? OwnershipTransferResult.ALREADY_TRANSFERRED
                : OwnershipTransferResult.CHANGED_CONCURRENTLY;
    }

    public CanonicalConversationMember findConversationMember(UUID conversationId, UUID userId) {
        Row row = session.execute(loadConversationMember.bind(conversationId, userId)).one();
        return row == null ? null : mapConversationMember(row);
    }

    public List<CanonicalConversationMember> listConversationMembers(
            UUID conversationId,
            UUID afterUserId,
            int limit) {
        var statement = afterUserId == null
                ? listConversationMembers.bind(conversationId, limit)
                : listConversationMembersAfter.bind(conversationId, afterUserId, limit);
        return session.execute(statement).all().stream()
                .map(this::mapConversationMember)
                .toList();
    }

    public void updateMemberChatPolicy(
            UUID conversationId, UUID userId, Instant mutedUntil, Integer messageIntervalSeconds) {
        session.execute(updateMemberChatPolicy.bind(
                mutedUntil, messageIntervalSeconds, conversationId, userId));
    }

    public void updateMemberNotificationPolicy(
            UUID conversationId, UUID userId, String notificationOverride) {
        session.execute(updateMemberNotificationPolicy.bind(notificationOverride, conversationId, userId));
        Row projection = findAnyConversationProjectionRow(userId, conversationId);
        if (projection != null) {
            session.execute(updateConversationProjectionNotification.bind(
                    notificationOverride,
                    userId,
                    projection.getBoolean("is_pinned"),
                    projection.getInstant("last_activity_at"),
                    conversationId));
        }
    }

    private void deleteConversationMembershipProjection(UUID userId, UUID conversationId) {
        Row projection = findAnyConversationProjectionRow(userId, conversationId);
        if (projection != null) {
            session.execute(deleteConversationProjection.bind(
                    userId,
                    projection.getBoolean("is_pinned"),
                    projection.getInstant("last_activity_at"),
                    conversationId));
        }
    }

    public enum MembershipMutationResult {
        ADDED,
        REMOVED,
        ALREADY_MEMBER,
        NOT_MEMBER,
        CAPACITY_REACHED,
        OWNER_PROTECTED
    }

    public enum OwnershipTransferResult {
        TRANSFERRED,
        ALREADY_TRANSFERRED,
        CHANGED_CONCURRENTLY
    }

    public record MembershipState(
            int memberCount,
            int maxMembers,
            UUID ownerId,
            Instant ownerUpdatedAt,
            long roleRevision) {
    }

    public void addConversationMembershipProjection(UUID userId, CanonicalConversation conversation, CanonicalConversationMember member) {
        session.execute(saveConversationProjection.bind(
                userId,
                false,
                conversation.lastActivityAt(),
                conversation.conversationId(),
                conversation.conversationType(),
                conversation.visibility(),
                member.roleIds(),
                member.joinedAt(),
                null,
                0,
                member.notificationOverride()
        ));
    }

    public List<ConversationProjectionRow> listConversationProjectionByUser(
            UUID userId, ConversationProjectionCursor cursor, int limit) {
        List<Row> rows;
        if (cursor == null) {
            rows = session.execute(listConversationsByUser.bind(userId, limit)).all();
        } else {
            rows = new ArrayList<>(session.execute(listConversationsByUserAfter.bind(
                    userId, cursor.pinned(), cursor.lastActivityAt(), cursor.conversationId(), limit)).all());
            if (cursor.pinned() && rows.size() < limit) {
                rows.addAll(session.execute(listUnpinnedConversationsByUser.bind(
                        userId, limit - rows.size())).all());
            }
        }
        return rows.stream()
                .map(this::mapConversationProjection)
                .filter(row -> row.conversation() != null)
                .toList();
    }

    private ConversationProjectionRow mapConversationProjection(Row row) {
        UdtValue summary = row.getUdtValue("last_message");
        LastMessageProjection lastMessage = summary == null ? null : new LastMessageProjection(
                summary.getUuid("message_id"),
                summary.getUuid("sender_id"),
                summary.getString("sender_display_name"),
                summary.getString("content_preview"),
                summary.getString("message_type"),
                summary.getInstant("created_at"),
                summary.getBoolean("is_deleted"),
                summary.getBoolean("has_attachments"));
        return new ConversationProjectionRow(
                findConversation(row.getUuid("conversation_id")),
                row.getBoolean("is_pinned"),
                row.getInt("unread_count"),
                row.getInstant("joined_at"),
                row.getString("notification_override"),
                lastMessage,
                row.getInstant("last_activity_at"));
    }

    public void updateConversationProjectionRoles(UUID userId, UUID conversationId, Set<UUID> roleIds) {
        Row row = findAnyConversationProjectionRow(userId, conversationId);
        if (row != null) {
            session.execute(updateConversationProjectionRoles.bind(
                    roleIds,
                    userId,
                    row.getBoolean("is_pinned"),
                    row.getInstant("last_activity_at"),
                    conversationId));
        }
    }

    public boolean updateMemberRolesIfUnchanged(
            UUID conversationId,
            UUID userId,
            Set<UUID> expectedRoleIds,
            Set<UUID> nextRoleIds,
            long expectedRoleRevision) {
        return session.execute(updateMemberRolesIfUnchanged.bind(
                nextRoleIds, conversationId, userId, expectedRoleIds, expectedRoleRevision)).wasApplied();
    }

    public boolean advanceConversationRoleRevision(UUID conversationId, long expectedRevision) {
        return session.execute(advanceConversationRoleRevision.bind(
                expectedRevision + 1, conversationId, expectedRevision)).wasApplied();
    }

    public long requireConversationRoleRevision(UUID conversationId) {
        return requireMembershipState(conversationId).roleRevision();
    }

    public boolean tryPinConversation(UUID userId, UUID conversationId, int targetPinSlot) {
        if (targetPinSlot < 0 || targetPinSlot > 2) {
            return false;
        }
        if (isConversationAlreadyPinned(userId, conversationId)) {
            return true;
        }
        Row row = findAnyConversationProjectionRow(userId, conversationId);
        if (row == null) {
            return false;
        }
        if (!session.execute(pinConversationSlot.bind(userId, (byte) targetPinSlot, conversationId)).wasApplied()) {
            return false;
        }

        session.execute(deleteConversationProjection.bind(
                userId,
                false,
                row.getInstant("last_activity_at"),
                conversationId
        ));
        session.execute(saveConversationProjection.bind(
                userId,
                true,
                row.getInstant("last_activity_at"),
                conversationId,
                row.getString("conversation_type"),
                row.getString("visibility"),
                row.getSet("role_ids", UUID.class),
                row.getInstant("joined_at"),
                row.getUdtValue("last_message"),
                row.getInt("unread_count"),
                row.getString("notification_override")
        ));
        return true;
    }

    public boolean unpinConversation(UUID userId, UUID conversationId) {
        Integer pinSlot = findConversationPinSlot(userId, conversationId);
        if (pinSlot == null) {
            return false;
        }
        unpinConversation(userId, pinSlot);
        return true;
    }

    private void unpinConversation(UUID userId, int pinSlot) {
        if (pinSlot < 0 || pinSlot > 2) {
            return;
        }
        Row slotRow = findConversationPinSlot(userId, (byte) pinSlot);
        if (slotRow == null) {
            return;
        }

        UUID conversationId = slotRow.getUuid("conversation_id");
        session.execute(unpinConversationSlot.bind(userId, (byte) pinSlot));

        var pinnedRow = findConversationProjectionByPinnedSlot(userId, conversationId);
        if (pinnedRow != null) {
            session.execute(deleteConversationProjection.bind(
                    userId,
                    true,
                    pinnedRow.getInstant("last_activity_at"),
                    conversationId
            ));
            session.execute(saveConversationProjection.bind(
                    userId,
                    false,
                    pinnedRow.getInstant("last_activity_at"),
                    conversationId,
                    pinnedRow.getString("conversation_type"),
                    pinnedRow.getString("visibility"),
                    pinnedRow.getSet("role_ids", UUID.class),
                    pinnedRow.getInstant("joined_at"),
                    pinnedRow.getUdtValue("last_message"),
                    pinnedRow.getInt("unread_count"),
                    pinnedRow.getString("notification_override")
            ));
        }
    }

    private boolean isConversationAlreadyPinned(UUID userId, UUID conversationId) {
        return findConversationPinSlot(userId, conversationId) != null;
    }

    private Integer findConversationPinSlot(UUID userId, UUID conversationId) {
        var rows = session.execute(listPinSlots.bind(userId)).all();
        for (Row row : rows) {
            if (conversationId.equals(row.getUuid("conversation_id"))) {
                return (int) row.getByte("pin_slot");
            }
        }
        return null;
    }

    private Row findConversationPinSlot(UUID userId, byte pinSlot) {
        var rows = session.execute(listPinSlots.bind(userId)).all();
        for (Row row : rows) {
            if (pinSlot == row.getByte("pin_slot")) {
                return row;
            }
        }
        return null;
    }

    private Row findAnyConversationProjectionRow(UUID userId, UUID conversationId) {
        var rows = session.execute(queryConversationProjectionAny.bind(userId)).all();
        for (Row row : rows) {
            if (conversationId.equals(row.getUuid("conversation_id"))) {
                return row;
            }
        }
        return null;
    }

    private Row findConversationProjectionByPinnedSlot(UUID userId, UUID conversationId) {
        var rows = session.execute(queryConversationProjectionPinned.bind(userId)).all();
        for (Row row : rows) {
            if (conversationId.equals(row.getUuid("conversation_id"))) {
                return row;
            }
        }
        return null;
    }

    // -------- mapping --------
    private CanonicalConversation mapConversation(Row row, MembershipState membership) {
        return new CanonicalConversation(
                row.getUuid("conversation_id"),
                row.getString("conversation_type"),
                row.getString("visibility"),
                row.getString("join_policy"),
                row.getString("name"),
                row.getString("name_normalized"),
                row.getString("description"),
                row.getString("avatar_url"),
                row.getUuid("avatar_asset_id"),
                row.getUuid("created_by"),
                membership.ownerId(),
                row.getInstant("created_at"),
                latest(row.getInstant("updated_at"), membership.ownerUpdatedAt()),
                row.getBoolean("is_deleted"),
                row.getInstant("deleted_at"),
                row.getString("chat_mode"),
                row.getInt("slow_mode_seconds"),
                row.getInt("message_retention_days"),
                row.getString("default_notification_level"),
                row.getString("category_id"),
                row.getSet("community_tags", String.class),
                row.getString("language_code"),
                membership.maxMembers(),
                membership.memberCount(),
                row.getObject("last_message") != null,
                row.getInstant("last_activity_at")
        );
    }

    private Instant latest(Instant first, Instant second) {
        return first.isAfter(second) ? first : second;
    }

    private CanonicalConversationMember mapConversationMember(Row row) {
        return new CanonicalConversationMember(
                row.getUuid("conversation_id"),
                row.getUuid("user_id"),
                row.getSet("role_ids", UUID.class),
                row.getInstant("joined_at"),
                row.getUuid("invited_by"),
                row.getInstant("muted_until"),
                row.isNull("message_interval_seconds") ? null : row.getInt("message_interval_seconds"),
                row.getString("notification_override"),
                row.getUuid("last_read_message_id"),
                row.getInstant("last_read_at")
        );
    }

    private CommunityJoinRequestRow mapCommunityJoinRequest(Row row) {
        return new CommunityJoinRequestRow(
                row.getUuid("conversation_id"), row.getUuid("user_id"), row.getUuid("request_id"),
                row.getUuid("requested_at"), row.getString("status"), row.getString("reason"),
                row.getString("resolution_decision"), row.getUuid("resolved_by"), row.getInstant("resolved_at"));
    }

    public record CommunityDirectoryKey(String nameNormalized, UUID conversationId) {
    }

    public record CommunityJoinClaim(String status, boolean created) {
    }

    public record CommunityJoinRequestRow(
            UUID conversationId,
            UUID userId,
            UUID requestId,
            UUID requestedAt,
            String status,
            String reason,
            String resolutionDecision,
            UUID resolvedBy,
            Instant resolvedAt) {
        public CanonicalApiContracts.JoinRequestView toView() {
            return new CanonicalApiContracts.JoinRequestView(
                    conversationId, requestedAt, requestId, userId, null, status, resolvedBy, resolvedAt);
        }
    }

    public record ConversationProjectionRow(
            CanonicalConversation conversation,
            boolean pinned,
            int unreadCount,
            Instant joinedAt,
            String notificationOverride,
            LastMessageProjection lastMessage,
            Instant lastActivityAt) {
    }

    public record ConversationProjectionCursor(
            boolean pinned,
            Instant lastActivityAt,
            UUID conversationId) {
    }

    public record LastMessageProjection(
            UUID messageId,
            UUID senderId,
            String senderDisplayName,
            String contentPreview,
            String messageType,
            Instant createdAt,
            boolean deleted,
            boolean hasAttachments) {
    }

}
