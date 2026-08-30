package com.chatapp.chat_service.canonical.repository;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.community.CommunityDirectoryFilter;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomEvent;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.model.ConversationMember;
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
import java.time.LocalDate;
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
    private final UserDefinedType attachmentRefType;
    private final UserDefinedType messageSummaryType;

    private final PreparedStatement claimUsername;
    private final PreparedStatement claimEmail;
    private final PreparedStatement insertUser;
    private final PreparedStatement lookupUserIdByUsername;
    private final PreparedStatement lookupUserById;
    private final PreparedStatement insertUserPrefix;
    private final PreparedStatement listUsersByPrefix;
    private final PreparedStatement listUsersByPrefixAfter;
    private final PreparedStatement updateUserProfile;
    private final PreparedStatement updateUserPrefixProfile;
    private final PreparedStatement updateUserAccountStatus;
    private final PreparedStatement updateUserPrefixAccountStatus;
    private final PreparedStatement insertRefreshToken;
    private final PreparedStatement insertRefreshTokenOwner;
    private final PreparedStatement loadRefreshTokenOwner;
    private final PreparedStatement revokeRefreshTokenOwner;
    private final PreparedStatement listRefreshTokensByUser;
    private final PreparedStatement revokeRefreshTokenByUser;
    private final PreparedStatement listDevicesByUser;
    private final PreparedStatement loadDeviceByUser;
    private final PreparedStatement saveDevice;
    private final PreparedStatement deactivateDevice;
    private final PreparedStatement touchDevice;

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
    private final PreparedStatement replaceCommunityJoinRequest;
    private final PreparedStatement claimCommunityJoinResolution;
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
    private final PreparedStatement saveBan;
    private final PreparedStatement saveBanByUser;
    private final PreparedStatement loadConversationBan;
    private final PreparedStatement deleteConversationBan;
    private final PreparedStatement deleteConversationBanByUser;
    private final PreparedStatement deleteConversationBanIfExpiresAt;
    private final PreparedStatement deleteConversationBanByUserIfExpiresAt;
    private final PreparedStatement clearMemberMuteIfExpiresAt;

    private final PreparedStatement claimMessageIdByClient;
    private final PreparedStatement loadMessageIdByClient;
    private final PreparedStatement saveMessage;
    private final PreparedStatement loadMessage;
    private final PreparedStatement listMessagesByBucket;
    private final PreparedStatement listMessagesByBucketBefore;
    private final PreparedStatement saveMessageBucket;
    private final PreparedStatement listMessageBuckets;
    private final PreparedStatement listMessageBucketsBefore;
    private final PreparedStatement saveAttachment;
    private final PreparedStatement saveMentionByMessage;
    private final PreparedStatement saveMentionInbox;
    private final PreparedStatement saveReaction;
    private final PreparedStatement deleteReaction;
    private final PreparedStatement saveReactionBucket;
    private final PreparedStatement deleteReactionBucket;
    private final PreparedStatement listReactionBucket;
    private final PreparedStatement setMessagePinned;
    private final PreparedStatement updateConversationMemberRead;
    private final PreparedStatement saveMessageReadReceipt;
    private final PreparedStatement listMessageReadReceipts;
    private final PreparedStatement updateMessageReadBucketSummary;
    private final PreparedStatement listMessageReadBucketSummaries;
    private final PreparedStatement saveMessageRevision;
    private final PreparedStatement listMessageRevisions;
    private final PreparedStatement loadMessageEditState;
    private final PreparedStatement updateMessageContent;
    private final PreparedStatement updateMessageDeleted;
    private final PreparedStatement claimMessagePinSlot;
    private final PreparedStatement listMessagePinSlots;
    private final PreparedStatement listMessageAttachments;
    private final PreparedStatement findMessageByBucketAndId;

    private final PreparedStatement savePoll;
    private final PreparedStatement savePollByConversation;
    private final PreparedStatement loadPollById;
    private final PreparedStatement loadPollsById;
    private final PreparedStatement initializePollState;
    private final PreparedStatement loadPollAggregate;
    private final PreparedStatement loadPollAggregates;
    private final PreparedStatement loadPollVote;
    private final PreparedStatement loadPollVotes;
    private final PreparedStatement createPollVote;
    private final PreparedStatement replacePollVote;
    private final PreparedStatement removePollVote;
    private final PreparedStatement replacePollAggregate;
    private final PreparedStatement closePollState;
    private final PreparedStatement closePoll;
    private final PreparedStatement closePollProjection;

    private final PreparedStatement createInvite;
    private final PreparedStatement listInvitesByConversation;
    private final PreparedStatement loadInviteByToken;
    private final PreparedStatement updateInviteUseCount;
    private final PreparedStatement deactivateInvite;
    private final PreparedStatement recordInviteJoin;
    private final PreparedStatement claimInviteJoin;
    private final PreparedStatement reclaimFailedInviteJoin;
    private final PreparedStatement loadInviteJoin;
    private final PreparedStatement updateInviteJoinStatus;
    private final PreparedStatement updateInviteProjectionUseCount;
    private final PreparedStatement saveJoinRequest;
    private final PreparedStatement listJoinRequests;
    private final PreparedStatement loadJoinRequest;
    private final PreparedStatement claimJoinRequestResolution;
    private final PreparedStatement finishJoinRequestResolution;

    private final PreparedStatement getNotificationSetting;
    private final PreparedStatement saveNotificationSetting;
    private final PreparedStatement getChatPreferences;
    private final PreparedStatement saveChatPreferences;
    private final PreparedStatement listConversationPreferencesByUser;
    private final PreparedStatement saveConversationPreferences;
    private final PreparedStatement deleteConversationPreferences;
    private final PreparedStatement listNotificationsByMonth;
    private final PreparedStatement markNotificationAsRead;
    private final PreparedStatement deleteNotification;
    private final PreparedStatement deleteNotificationsByMonth;
    private final PreparedStatement upsertNotification;

    private final PreparedStatement saveRoomEvent;
    private final PreparedStatement listRoomEvents;
    private final PreparedStatement listRoomEventsBefore;
    private final PreparedStatement saveAuditByActor;
    private final PreparedStatement saveAuditByResource;
    private final PreparedStatement saveAuditByMonth;
    private final PreparedStatement listAuditByMonth;
    private final PreparedStatement saveOutboxEvent;
    private final PreparedStatement savePendingOutboxEvent;
    private final PreparedStatement listPendingOutboxEvents;
    private final PreparedStatement markOutboxEvent;
    private final PreparedStatement markPendingOutboxEvent;
    private final PreparedStatement deletePendingOutboxEvent;
    private final PreparedStatement saveAnalytics;
    private final PreparedStatement listAnalyticsByType;

    private final PreparedStatement queryConversationProjectionPinned;
    private final PreparedStatement queryConversationProjectionAny;

    public CanonicalCqlStore(CqlSession session) {
        this.session = session;
        this.attachmentRefType = session.getMetadata()
                .getKeyspace("chat_app")
                .flatMap(ks -> ks.getUserDefinedType("attachment_ref"))
                .orElseThrow(() -> new IllegalStateException("Missing UDT attachment_ref"));
        this.messageSummaryType = session.getMetadata()
                .getKeyspace("chat_app")
                .flatMap(ks -> ks.getUserDefinedType("message_summary"))
                .orElseThrow(() -> new IllegalStateException("Missing UDT message_summary"));

        this.claimUsername = session.prepare("""
                INSERT INTO user_id_by_username (username_normalized, user_id, created_at)
                VALUES (?, ?, ?) IF NOT EXISTS
                """);
        this.claimEmail = session.prepare("""
                INSERT INTO user_id_by_email (email_normalized, user_id, created_at)
                VALUES (?, ?, ?) IF NOT EXISTS
                """);
        this.insertUser = session.prepare("""
                INSERT INTO users_by_id
                    (user_id, username, username_normalized, email, email_normalized, password_hash,
                     auth_provider, external_subject, display_name, avatar_url, avatar_asset_id,
                     account_status, email_verified_at, locale, timezone, security_version, created_at, updated_at, last_login_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                """);
        this.lookupUserIdByUsername = session.prepare("SELECT user_id FROM user_id_by_username WHERE username_normalized = ?");
        this.lookupUserById = session.prepare("SELECT * FROM users_by_id WHERE user_id = ?");
        this.insertUserPrefix = session.prepare("""
                INSERT INTO users_by_username_prefix
                    (username_prefix, username_normalized, user_id, username, display_name, avatar_url, account_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """);
        this.listUsersByPrefix = session.prepare("""
                SELECT username_normalized, user_id, username, display_name, avatar_url, account_status
                FROM users_by_username_prefix
                WHERE username_prefix = ? LIMIT ?
                """);
        this.listUsersByPrefixAfter = session.prepare("""
                SELECT username_normalized, user_id, username, display_name, avatar_url, account_status
                FROM users_by_username_prefix
                WHERE username_prefix = ? AND (username_normalized, user_id) > (?, ?) LIMIT ?
                """);
        this.updateUserProfile = session.prepare("""
                UPDATE users_by_id SET display_name = ?, avatar_url = ?, updated_at = ?
                WHERE user_id = ?
                """);
        this.updateUserPrefixProfile = session.prepare("""
                UPDATE users_by_username_prefix SET display_name = ?, avatar_url = ?
                WHERE username_prefix = ? AND username_normalized = ? AND user_id = ?
                """);
        this.updateUserAccountStatus = session.prepare("""
                UPDATE users_by_id SET account_status = ?, security_version = security_version + 1, updated_at = ?
                WHERE user_id = ?
                """);
        this.updateUserPrefixAccountStatus = session.prepare("""
                UPDATE users_by_username_prefix SET account_status = ?
                WHERE username_prefix = ? AND username_normalized = ? AND user_id = ?
                """);
        this.insertRefreshToken = session.prepare("""
                INSERT INTO refresh_tokens_by_user
                    (user_id, issued_at, token_id, token_hash, device_id, expires_at, revoked_at, replaced_by_token_id)
                VALUES (?, ?, ?, ?, ?, ?, null, null)
                """);
        this.insertRefreshTokenOwner = session.prepare("""
                INSERT INTO refresh_token_owner_by_id
                    (token_id, user_id, token_hash, expires_at, revoked_at)
                VALUES (?, ?, ?, ?, null)
                """);
        this.loadRefreshTokenOwner = session.prepare("""
                SELECT token_id, user_id, token_hash, expires_at, revoked_at
                FROM refresh_token_owner_by_id WHERE token_id = ?
                """);
        this.revokeRefreshTokenOwner = session.prepare("""
                UPDATE refresh_token_owner_by_id
                SET revoked_at = ?, replaced_by_token_id = ?
                WHERE token_id = ? IF revoked_at = null
                """);
        this.listRefreshTokensByUser = session.prepare("""
                SELECT issued_at, token_id, device_id, expires_at, revoked_at, replaced_by_token_id
                FROM refresh_tokens_by_user WHERE user_id = ? LIMIT ?
                """);
        this.revokeRefreshTokenByUser = session.prepare("""
                UPDATE refresh_tokens_by_user SET revoked_at = ?
                WHERE user_id = ? AND issued_at = ? AND token_id = ? IF revoked_at = null
                """);
        this.listDevicesByUser = session.prepare("""
                SELECT device_id, platform, push_provider, device_name, app_version,
                       is_active, created_at, last_seen_at
                FROM user_devices_by_user WHERE user_id = ? LIMIT ?
                """);
        this.loadDeviceByUser = session.prepare("""
                SELECT device_id, platform, push_provider, device_name, app_version,
                       is_active, created_at, last_seen_at
                FROM user_devices_by_user WHERE user_id = ? AND device_id = ?
                """);
        this.saveDevice = session.prepare("""
                INSERT INTO user_devices_by_user
                    (user_id, device_id, platform, push_provider, push_token, device_name,
                     app_version, is_active, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, ?)
                """);
        this.deactivateDevice = session.prepare("""
                UPDATE user_devices_by_user SET is_active = false, last_seen_at = ?
                WHERE user_id = ? AND device_id = ? IF is_active = true
                """);
        this.touchDevice = session.prepare("""
                UPDATE user_devices_by_user SET last_seen_at = ?
                WHERE user_id = ? AND device_id = ? IF is_active = true
                """);

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
        this.replaceCommunityJoinRequest = session.prepare("""
                UPDATE community_join_request_by_user
                SET request_id = ?, status = 'PENDING', requested_at = ?, reason = ?,
                    resolution_decision = null, resolved_by = null, resolved_at = null, updated_at = ?
                WHERE conversation_id = ? AND user_id = ? IF request_id = ?
                """);
        this.claimCommunityJoinResolution = session.prepare("""
                UPDATE community_join_request_by_user
                SET status = 'APPROVING', resolution_decision = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
                WHERE conversation_id = ? AND user_id = ? IF request_id = ? AND status = 'PENDING'
                """);
        this.updateCommunityJoinClaim = session.prepare("""
                UPDATE community_join_request_by_user
                SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
                WHERE conversation_id = ? AND user_id = ? IF request_id = ? AND status = 'APPROVING'
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
        this.saveBan = session.prepare("""
                INSERT INTO conversation_bans_by_conversation
                    (conversation_id, user_id, banned_by, reason_code, reason_text, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, toTimestamp(now()), ?)
                """);
        this.saveBanByUser = session.prepare("""
                INSERT INTO conversation_bans_by_user
                    (user_id, conversation_id, banned_by, reason_code, created_at, expires_at)
                VALUES (?, ?, ?, ?, toTimestamp(now()), ?)
                """);
        this.loadConversationBan = session.prepare("""
                SELECT expires_at FROM conversation_bans_by_conversation
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.deleteConversationBan = session.prepare("""
                DELETE FROM conversation_bans_by_conversation
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.deleteConversationBanByUser = session.prepare("""
                DELETE FROM conversation_bans_by_user
                WHERE user_id = ? AND conversation_id = ?
                """);
        this.deleteConversationBanIfExpiresAt = session.prepare("""
                DELETE FROM conversation_bans_by_conversation
                WHERE conversation_id = ? AND user_id = ? IF expires_at = ?
                """);
        this.deleteConversationBanByUserIfExpiresAt = session.prepare("""
                DELETE FROM conversation_bans_by_user
                WHERE user_id = ? AND conversation_id = ? IF expires_at = ?
                """);
        this.clearMemberMuteIfExpiresAt = session.prepare("""
                UPDATE conversation_members_by_conversation SET muted_until = null
                WHERE conversation_id = ? AND user_id = ? IF muted_until = ?
                """);

        this.claimMessageIdByClient = session.prepare("""
                INSERT INTO message_id_by_client_id
                    (sender_id, client_message_id, conversation_id, message_bucket, message_id, request_fingerprint, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.loadMessageIdByClient = session.prepare("""
                SELECT message_id, conversation_id, message_bucket, request_fingerprint, created_at
                FROM message_id_by_client_id
                WHERE sender_id = ? AND client_message_id = ?
                """);
        this.saveMessage = session.prepare("""
                INSERT INTO messages_by_conversation_bucket (
                    conversation_id, message_bucket, message_id, sender_id, message_type, content,
                    content_format, reply_to_message_id, reply_to_sender_id, sticker_id, poll_id,
                    system_event_id, forwarded_from_conversation_id, forwarded_from_message_bucket,
                    forwarded_from_message_id, is_deleted, deleted_by, deleted_at, edited_at,
                    revision_no, has_attachments, has_mentions, is_pinned, created_at, client_message_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
                """);
        this.loadMessage = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.listMessagesByBucket = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? LIMIT ?
                """);
        this.listMessagesByBucketBefore = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id < ? LIMIT ?
                """);
        this.saveMessageBucket = session.prepare("""
                INSERT INTO message_buckets_by_conversation
                    (conversation_id, bucket_hour, message_bucket, last_message_id, last_message_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listMessageBuckets = session.prepare("""
                SELECT bucket_hour, message_bucket
                FROM message_buckets_by_conversation
                WHERE conversation_id = ? LIMIT ?
                """);
        this.listMessageBucketsBefore = session.prepare("""
                SELECT bucket_hour, message_bucket
                FROM message_buckets_by_conversation
                WHERE conversation_id = ? AND bucket_hour <= ? LIMIT ?
                """);
        this.saveAttachment = session.prepare("""
                INSERT INTO message_attachments_by_message
                    (conversation_id, message_bucket, message_id, attachment_id, attachment)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.saveMentionByMessage = session.prepare("""
                INSERT INTO message_mentions_by_message
                    (conversation_id, message_bucket, message_id, mentioned_user_id)
                VALUES (?, ?, ?, ?)
                """);
        this.saveMentionInbox = session.prepare("""
                INSERT INTO mentioned_messages_by_user
                    (mentioned_user_id, created_at, conversation_id, message_bucket, message_id, sender_id)
                VALUES (?, now(), ?, ?, ?, ?)
                """);
        this.saveReaction = session.prepare("""
                INSERT INTO message_reactions_by_message
                    (conversation_id, message_bucket, message_id, emoji, user_id, reacted_at)
                VALUES (?, ?, ?, ?, ?, now()) IF NOT EXISTS
                """);
        this.deleteReaction = session.prepare("""
                DELETE FROM message_reactions_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? AND emoji = ? AND user_id = ?
                IF EXISTS
                """);
        this.saveReactionBucket = session.prepare("""
                INSERT INTO message_reactions_by_conversation_bucket
                    (conversation_id, message_bucket, message_id, emoji, user_id, reacted_at)
                VALUES (?, ?, ?, ?, ?, now())
                """);
        this.deleteReactionBucket = session.prepare("""
                DELETE FROM message_reactions_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? AND emoji = ? AND user_id = ?
                """);
        this.listReactionBucket = session.prepare("""
                SELECT message_id, emoji, user_id
                FROM message_reactions_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id IN ?
                """);
        this.setMessagePinned = session.prepare("""
                UPDATE messages_by_conversation_bucket
                SET is_pinned = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.findMessageByBucketAndId = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.updateConversationMemberRead = session.prepare("""
                UPDATE conversation_members_by_conversation
                SET last_read_message_id = ?, last_read_at = ?
                WHERE conversation_id = ? AND user_id = ?
                """);
        this.saveMessageReadReceipt = session.prepare("""
                INSERT INTO message_read_receipts_by_message
                    (conversation_id, message_bucket, message_id, reader_id, read_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listMessageReadReceipts = session.prepare("""
                SELECT reader_id, read_at
                FROM message_read_receipts_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.updateMessageReadBucketSummary = session.prepare("""
                UPDATE message_read_summary_by_conversation_bucket
                SET latest_read_at = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.listMessageReadBucketSummaries = session.prepare("""
                SELECT message_id, latest_read_at
                FROM message_read_summary_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id IN ?
                """);
        this.saveMessageRevision = session.prepare("""
                INSERT INTO message_revisions_by_message
                    (conversation_id, message_bucket, message_id, revision_no, content, action, edited_by, edited_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listMessageRevisions = session.prepare("""
                SELECT revision_no, content, action, edited_by, edited_at
                FROM message_revisions_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.loadMessageEditState = session.prepare("""
                SELECT content, sender_id, is_deleted, revision_no
                FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.updateMessageContent = session.prepare("""
                UPDATE messages_by_conversation_bucket
                SET content = ?, edited_at = ?, revision_no = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? IF revision_no = ?
                """);
        this.updateMessageDeleted = session.prepare("""
                UPDATE messages_by_conversation_bucket
                SET is_deleted = true, deleted_by = ?, deleted_at = ?, revision_no = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? IF revision_no = ?
                """);
        this.listMessageAttachments = session.prepare("""
                SELECT attachment_id, attachment
                FROM message_attachments_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.claimMessagePinSlot = session.prepare("""
                INSERT INTO pinned_message_slots_by_conversation
                    (conversation_id, pin_slot, message_bucket, message_id, pinned_by, pinned_at)
                VALUES (?, ?, ?, ?, ?, now()) IF NOT EXISTS
                """);
        this.listMessagePinSlots = session.prepare("""
                SELECT pin_slot, message_bucket, message_id, pinned_by
                FROM pinned_message_slots_by_conversation
                WHERE conversation_id = ?
                """);

        this.savePoll = session.prepare("""
                INSERT INTO polls_by_id
                    (poll_id, conversation_id, message_bucket, message_id, question, options,
                     is_multiple_choice, is_anonymous, is_closed, created_by, created_at,
                     closes_at, closed_by, closed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.savePollByConversation = session.prepare("""
                INSERT INTO polls_by_conversation
                    (conversation_id, created_at, poll_id, message_bucket, message_id, is_closed)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
        this.loadPollById = session.prepare("SELECT * FROM polls_by_id WHERE poll_id = ?");
        this.loadPollsById = session.prepare("SELECT * FROM polls_by_id WHERE poll_id IN ?");
        this.initializePollState = session.prepare("""
                INSERT INTO poll_state_by_poll
                    (poll_id, voter_id, selected_option_indexes, voted_at,
                     option_counts, total_voters, aggregate_version, is_closed)
                VALUES (?, ?, ?, ?, ?, 0, 0, false)
                """);
        this.loadPollAggregate = session.prepare("""
                SELECT DISTINCT poll_id, option_counts, total_voters, aggregate_version, is_closed
                FROM poll_state_by_poll WHERE poll_id = ?
                """);
        this.loadPollAggregates = session.prepare("""
                SELECT DISTINCT poll_id, option_counts, total_voters, aggregate_version, is_closed
                FROM poll_state_by_poll WHERE poll_id IN ?
                """);
        this.loadPollVote = session.prepare("""
                SELECT selected_option_indexes FROM poll_state_by_poll WHERE poll_id = ? AND voter_id = ?
                """);
        this.loadPollVotes = session.prepare("""
                SELECT poll_id, selected_option_indexes FROM poll_state_by_poll
                WHERE poll_id IN ? AND voter_id = ?
                """);
        this.createPollVote = session.prepare("""
                INSERT INTO poll_state_by_poll (poll_id, voter_id, selected_option_indexes, voted_at)
                VALUES (?, ?, ?, ?) IF NOT EXISTS
                """);
        this.replacePollVote = session.prepare("""
                UPDATE poll_state_by_poll SET selected_option_indexes = ?, voted_at = ?
                WHERE poll_id = ? AND voter_id = ? IF selected_option_indexes = ?
                """);
        this.removePollVote = session.prepare("""
                DELETE FROM poll_state_by_poll WHERE poll_id = ? AND voter_id = ?
                IF selected_option_indexes = ?
                """);
        this.replacePollAggregate = session.prepare("""
                UPDATE poll_state_by_poll
                SET option_counts = ?, total_voters = ?, aggregate_version = ?
                WHERE poll_id = ? IF aggregate_version = ? AND is_closed = false
                """);
        this.closePollState = session.prepare("""
                UPDATE poll_state_by_poll SET is_closed = true
                WHERE poll_id = ? IF is_closed = false
                """);
        this.closePoll = session.prepare("""
                UPDATE polls_by_id SET is_closed = true, closed_by = ?, closed_at = ?
                WHERE poll_id = ? IF is_closed = false
                """);
        this.closePollProjection = session.prepare("""
                UPDATE polls_by_conversation SET is_closed = true
                WHERE conversation_id = ? AND created_at = ? AND poll_id = ?
                """);

        this.createInvite = session.prepare("""
                INSERT INTO invitation_links_by_token
                    (link_token, link_id, conversation_id, created_by, created_at, invite_kind,
                     join_policy, display_name, expires_at, is_active, max_uses, used_count, revoked_by, revoked_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, null, null)
                """);
        this.listInvitesByConversation = session.prepare("""
                SELECT * FROM invitation_links_by_conversation WHERE conversation_id = ? LIMIT ?
                """);
        this.loadInviteByToken = session.prepare("SELECT * FROM invitation_links_by_token WHERE link_token = ?");
        this.updateInviteUseCount = session.prepare("""
                UPDATE invitation_links_by_token
                SET used_count = ?, is_active = ?
                WHERE link_token = ? IF used_count = ? AND is_active = true
                """);
        this.updateInviteProjectionUseCount = session.prepare("""
                UPDATE invitation_links_by_conversation SET used_count = ?, is_active = ?
                WHERE conversation_id = ? AND created_at = ? AND link_id = ?
                """);
        this.deactivateInvite = session.prepare("""
                UPDATE invitation_links_by_token
                SET is_active = false, revoked_by = ?, revoked_at = ?
                WHERE link_token = ?
                """);
        this.recordInviteJoin = session.prepare("""
                INSERT INTO invitation_joins_by_link
                    (link_id, joined_at, user_id, outcome, ip_hash)
                VALUES (?, now(), ?, ?, ?)
                """);
        this.claimInviteJoin = session.prepare("""
                INSERT INTO invite_join_by_link_user
                    (link_id, user_id, request_id, status, first_requested_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.reclaimFailedInviteJoin = session.prepare("""
                UPDATE invite_join_by_link_user
                SET request_id = ?, status = 'PENDING', updated_at = ?
                WHERE link_id = ? AND user_id = ? IF status = 'FAILED'
                """);
        this.loadInviteJoin = session.prepare("""
                SELECT status FROM invite_join_by_link_user WHERE link_id = ? AND user_id = ?
                """);
        this.saveJoinRequest = session.prepare("""
                INSERT INTO join_requests_by_conversation
                    (conversation_id, requested_at, request_id, user_id, link_id, link_token, status)
                VALUES (?, now(), ?, ?, ?, ?, 'PENDING')
                """);
        this.listJoinRequests = session.prepare("""
                SELECT * FROM join_requests_by_conversation WHERE conversation_id = ? LIMIT ?
                """);
        this.loadJoinRequest = session.prepare("""
                SELECT * FROM join_requests_by_conversation
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                """);
        this.claimJoinRequestResolution = session.prepare("""
                UPDATE join_requests_by_conversation
                SET status = 'APPROVING', resolution_decision = ?, resolved_by = ?, resolved_at = ?
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ? IF status = 'PENDING'
                """);
        this.finishJoinRequestResolution = session.prepare("""
                UPDATE join_requests_by_conversation SET status = ?, resolved_by = ?, resolved_at = ?
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                """);
        this.updateInviteJoinStatus = session.prepare("""
                UPDATE invite_join_by_link_user SET status = ?, updated_at = ?
                WHERE link_id = ? AND user_id = ?
                """);

        this.getNotificationSetting = session.prepare("SELECT * FROM user_notification_preferences WHERE user_id = ?");
        this.saveNotificationSetting = session.prepare("""
                INSERT INTO user_notification_preferences
                    (user_id, global_level, push_enabled, email_enabled, desktop_enabled, sound_enabled,
                     quiet_hours_start, quiet_hours_end, timezone, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.getChatPreferences = session.prepare("SELECT * FROM user_chat_preferences WHERE user_id = ?");
        this.saveChatPreferences = session.prepare("""
                INSERT INTO user_chat_preferences
                    (user_id, default_theme_id, default_bubble_style_id, default_background_asset_id, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listConversationPreferencesByUser = session.prepare("""
                SELECT * FROM conversation_preferences_by_user
                WHERE user_id = ? LIMIT ?
                """);
        this.saveConversationPreferences = session.prepare("""
                INSERT INTO conversation_preferences_by_user
                    (user_id, conversation_id, theme_id, bubble_style_id, background_asset_id,
                     custom_background_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """);
        this.deleteConversationPreferences = session.prepare("""
                DELETE FROM conversation_preferences_by_user
                WHERE user_id = ? AND conversation_id = ?
                """);
        this.listNotificationsByMonth = session.prepare("""
                SELECT * FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ? LIMIT ?
                """);
        this.markNotificationAsRead = session.prepare("""
                UPDATE notifications_by_user
                SET is_read = true, read_at = ?
                WHERE user_id = ? AND notification_month = ? AND notification_id = ?
                """);
        this.deleteNotification = session.prepare("""
                DELETE FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ? AND notification_id = ?
                """);
        this.deleteNotificationsByMonth = session.prepare("""
                DELETE FROM notifications_by_user
                WHERE user_id = ? AND notification_month = ?
                """);
        this.upsertNotification = session.prepare("""
                INSERT INTO notifications_by_user
                    (user_id, notification_month, notification_id, notification_type, priority,
                     conversation_id, message_bucket, message_id, actor_id, title, body_preview,
                     deep_link, action_payload, is_read, read_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);

        this.queryConversationProjectionPinned = session.prepare("""
                SELECT conversation_id, conversation_type, visibility, role_ids, joined_at, last_activity_at, notification_override, last_message, unread_count
                FROM conversations_by_user
                WHERE user_id = ? AND is_pinned = true
                """);
        this.queryConversationProjectionAny = session.prepare("""
                SELECT * FROM conversations_by_user WHERE user_id = ? AND is_pinned IN (true, false)
                """);
        this.saveRoomEvent = session.prepare("""
                INSERT INTO room_events_by_conversation
                    (conversation_id, event_month, event_id, event_type, actor_id, target_user_id,
                     message_bucket, message_id, reason_code, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listRoomEvents = session.prepare("""
                SELECT conversation_id, event_month, event_id, event_type, actor_id, target_user_id,
                       message_bucket, message_id, reason_code, metadata, created_at
                FROM room_events_by_conversation
                WHERE conversation_id = ? AND event_month = ? LIMIT ?
                """);
        this.listRoomEventsBefore = session.prepare("""
                SELECT conversation_id, event_month, event_id, event_type, actor_id, target_user_id,
                       message_bucket, message_id, reason_code, metadata, created_at
                FROM room_events_by_conversation
                WHERE conversation_id = ? AND event_month = ? AND event_id < ? LIMIT ?
                """);
        this.saveAuditByActor = session.prepare("""
                INSERT INTO audit_events_by_actor
                    (actor_id, event_month, event_id, action, resource_type, resource_id,
                     conversation_id, target_user_id, outcome, reason_code, before_state,
                     after_state, request_id, ip_hash, user_agent_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.saveAuditByResource = session.prepare("""
                INSERT INTO audit_events_by_resource
                    (resource_type, resource_id, event_month, event_id, actor_id, action, outcome, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.saveAuditByMonth = session.prepare("""
                INSERT INTO audit_events_by_month
                    (event_month, event_id, action, resource_type, resource_id, actor_id,
                     conversation_id, target_user_id, outcome, reason_code, before_state,
                     after_state, request_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listAuditByMonth = session.prepare("""
                SELECT event_month, event_id, action, resource_type, resource_id, actor_id,
                       conversation_id, target_user_id, outcome, reason_code, before_state,
                       after_state, request_id, created_at
                FROM audit_events_by_month
                WHERE event_month = ? LIMIT ?
                """);
        this.saveOutboxEvent = session.prepare("""
                INSERT INTO outbox_events_by_partition
                    (outbox_partition, event_id, aggregate_type, aggregate_id, event_type,
                     payload_json, created_at, publish_attempts)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                """);
        this.savePendingOutboxEvent = session.prepare("""
                INSERT INTO outbox_pending_events_by_partition
                    (outbox_partition, event_id, aggregate_type, aggregate_id, event_type,
                     payload_json, created_at, publish_attempts)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                """);
        this.listPendingOutboxEvents = session.prepare("""
                SELECT outbox_partition, event_id, aggregate_type, aggregate_id, event_type,
                       payload_json, created_at, publish_attempts
                FROM outbox_pending_events_by_partition
                WHERE outbox_partition = ? LIMIT ?
                """);
        this.markOutboxEvent = session.prepare("""
                UPDATE outbox_events_by_partition
                SET published_at = ?, publish_attempts = ?
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.markPendingOutboxEvent = session.prepare("""
                UPDATE outbox_pending_events_by_partition
                SET publish_attempts = ?
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.deletePendingOutboxEvent = session.prepare("""
                DELETE FROM outbox_pending_events_by_partition
                WHERE outbox_partition = ? AND event_id = ?
                """);
        this.saveAnalytics = session.prepare("""
                INSERT INTO analytics_events_by_day_type
                    (event_day, event_type, event_shard, occurred_at, event_id, actor_id, conversation_id, dimensions)
                VALUES (?, ?, ?, now(), ?, ?, ?, ?)
                """);
        this.listAnalyticsByType = session.prepare("""
                SELECT event_day, event_type, event_shard, event_id, actor_id, conversation_id, dimensions
                FROM analytics_events_by_day_type
                WHERE event_day = ? AND event_type = ? AND event_shard = ? LIMIT ?
                """);
    }

    // -------- users --------
    public boolean claimUsername(String usernameNormalized, UUID userId, Instant now) {
        return session.execute(claimUsername.bind(usernameNormalized, userId, now)).wasApplied();
    }

    public boolean claimEmail(String emailNormalized, UUID userId, Instant now) {
        return session.execute(claimEmail.bind(emailNormalized, userId, now)).wasApplied();
    }

    public void saveUser(CanonicalUser user) {
        session.execute(insertUser.bind(
                user.userId(),
                user.username(),
                user.usernameNormalized(),
                user.email(),
                user.emailNormalized(),
                user.passwordHash(),
                user.authProvider(),
                user.externalSubject(),
                user.displayName(),
                user.avatarUrl(),
                null,
                user.accountStatus(),
                null,
                null,
                "UTC",
                user.createdAt(),
                user.updatedAt(),
                user.lastLoginAt(),
                null
        ));
        BatchStatementBuilder prefixes = BatchStatement.builder(BatchType.UNLOGGED);
        for (String prefix : usernamePrefixes(user.usernameNormalized())) {
            prefixes.addStatement(insertUserPrefix.bind(
                    prefix,
                    user.usernameNormalized(),
                    user.userId(),
                    user.username(),
                    user.displayName(),
                    user.avatarUrl(),
                    user.accountStatus()));
        }
        session.execute(prefixes.build());
    }

    public CanonicalUser findUserByUsername(String normalizedUsername) {
        Row idRow = session.execute(lookupUserIdByUsername.bind(normalizedUsername)).one();
        if (idRow == null) {
            return null;
        }
        return findUserById(idRow.getUuid("user_id"));
    }

    public CanonicalUser findUserById(UUID userId) {
        Row row = session.execute(lookupUserById.bind(userId)).one();
        return row == null ? null : mapUser(row);
    }

    public void insertRefreshToken(UUID userId, UUID issuedAt, UUID tokenId, String tokenHash, Instant expiresAt) {
        session.execute(insertRefreshToken.bind(userId, issuedAt, tokenId, tokenHash, null, expiresAt));
        session.execute(insertRefreshTokenOwner.bind(tokenId, userId, tokenHash, expiresAt));
    }

    public RefreshTokenOwnerRow findRefreshTokenOwner(UUID tokenId) {
        Row row = session.execute(loadRefreshTokenOwner.bind(tokenId)).one();
        if (row == null) {
            return null;
        }
        return new RefreshTokenOwnerRow(
                row.getUuid("token_id"),
                row.getUuid("user_id"),
                row.getString("token_hash"),
                row.getInstant("expires_at"),
                row.getInstant("revoked_at"));
    }

    public boolean revokeRefreshToken(UUID tokenId, UUID replacementTokenId, Instant revokedAt) {
        return session.execute(revokeRefreshTokenOwner.bind(revokedAt, replacementTokenId, tokenId)).wasApplied();
    }

    /**
     * Lists the bounded session projection for an account without exposing token
     * hashes. The owner partition is authoritative for the session inventory.
     */
    public List<RefreshTokenSessionRow> listRefreshTokens(UUID userId, int limit) {
        int boundedLimit = Math.max(1, Math.min(200, limit));
        return session.execute(listRefreshTokensByUser.bind(userId, boundedLimit)).all().stream()
                .map(row -> new RefreshTokenSessionRow(
                        row.getUuid("token_id"),
                        row.getUuid("issued_at"),
                        row.getUuid("device_id"),
                        row.getInstant("expires_at"),
                        row.getInstant("revoked_at"),
                        row.getUuid("replaced_by_token_id")))
                .toList();
    }

    /**
     * Revokes a session in both the user inventory and token-owner lookup. The
     * conditional writes make concurrent rotation/revocation converge safely.
     */
    public boolean revokeRefreshTokenForUser(UUID userId, UUID tokenId, Instant revokedAt) {
        RefreshTokenOwnerRow owner = findRefreshTokenOwner(tokenId);
        if (owner == null || !userId.equals(owner.userId()) || owner.revokedAt() != null) {
            return false;
        }
        RefreshTokenSessionRow target = listRefreshTokens(userId, 200).stream()
                .filter(session -> tokenId.equals(session.tokenId()))
                .findFirst()
                .orElse(null);
        if (target == null || target.revokedAt() != null) {
            return false;
        }
        if (!session.execute(revokeRefreshTokenByUser.bind(
                revokedAt, userId, target.issuedAt(), tokenId)).wasApplied()) {
            return false;
        }
        session.execute(revokeRefreshTokenOwner.bind(revokedAt, null, tokenId));
        return true;
    }

    public List<DeviceSessionRow> listDevices(UUID userId, int limit) {
        int boundedLimit = Math.max(1, Math.min(200, limit));
        return session.execute(listDevicesByUser.bind(userId, boundedLimit)).all().stream()
                .map(row -> new DeviceSessionRow(
                        row.getUuid("device_id"),
                        row.getString("platform"),
                        row.getString("push_provider"),
                        row.getString("device_name"),
                        row.getString("app_version"),
                        Boolean.TRUE.equals(row.getBoolean("is_active")),
                        row.getInstant("created_at"),
                        row.getInstant("last_seen_at")))
                .toList();
    }

    public DeviceSessionRow saveDevice(
            UUID userId,
            UUID deviceId,
            String platform,
            String pushProvider,
            String pushToken,
            String deviceName,
            String appVersion,
            Instant seenAt) {
        Row existing = session.execute(loadDeviceByUser.bind(userId, deviceId)).one();
        Instant createdAt = existing == null
                ? seenAt
                : java.util.Objects.requireNonNull(existing.getInstant("created_at"), "device created_at is required");
        session.execute(saveDevice.bind(
                userId, deviceId, platform, pushProvider, pushToken, deviceName, appVersion, createdAt, seenAt));
        return new DeviceSessionRow(deviceId, platform, pushProvider, deviceName, appVersion,
                true, createdAt, seenAt);
    }

    public boolean touchDevice(UUID userId, UUID deviceId, Instant seenAt) {
        return session.execute(touchDevice.bind(seenAt, userId, deviceId)).wasApplied();
    }

    /**
     * Deactivates a device and revokes its currently indexed sessions. Session
     * revocation remains bounded to the account partition limit by design.
     */
    public boolean revokeDeviceForUser(UUID userId, UUID deviceId, Instant revokedAt) {
        DeviceSessionRow target = listDevices(userId, 200).stream()
                .filter(device -> deviceId.equals(device.deviceId()))
                .findFirst()
                .orElse(null);
        if (target == null || !target.active()) {
            return false;
        }
        if (!session.execute(deactivateDevice.bind(revokedAt, userId, deviceId)).wasApplied()) {
            return false;
        }
        for (RefreshTokenSessionRow token : listRefreshTokens(userId, 200)) {
            if (deviceId.equals(token.deviceId()) && token.revokedAt() == null) {
                revokeRefreshTokenForUser(userId, token.tokenId(), revokedAt);
            }
        }
        return true;
    }

    public List<UserDirectoryRow> searchUsersByPrefix(
            String prefix,
            String afterUsername,
            UUID afterUserId,
            int limit) {
        var result = afterUsername == null || afterUserId == null
                ? session.execute(listUsersByPrefix.bind(prefix, limit))
                : session.execute(listUsersByPrefixAfter.bind(prefix, afterUsername, afterUserId, limit));
        return result.all().stream()
                .map(row -> new UserDirectoryRow(
                        row.getString("username_normalized"),
                        row.getUuid("user_id"),
                        row.getString("username"),
                        row.getString("display_name"),
                        row.getString("avatar_url"),
                        row.getString("account_status")))
                .toList();
    }

    public CanonicalUser updateUserProfile(UUID userId, String displayName, String avatarUrl, Instant updatedAt) {
        CanonicalUser current = findUserById(userId);
        if (current == null) {
            return null;
        }
        session.execute(updateUserProfile.bind(displayName, avatarUrl, updatedAt, userId));
        BatchStatementBuilder prefixes = BatchStatement.builder(BatchType.UNLOGGED);
        for (String prefix : usernamePrefixes(current.usernameNormalized())) {
            prefixes.addStatement(updateUserPrefixProfile.bind(
                    displayName, avatarUrl, prefix, current.usernameNormalized(), userId));
        }
        session.execute(prefixes.build());
        return new CanonicalUser(
                current.userId(), current.username(), current.usernameNormalized(), current.email(),
                current.emailNormalized(), current.passwordHash(), current.authProvider(), current.externalSubject(),
                displayName, avatarUrl, current.accountStatus(), current.createdAt(), updatedAt, current.lastLoginAt());
    }

    public CanonicalUser updateUserAccountStatus(UUID userId, String accountStatus, Instant updatedAt) {
        CanonicalUser current = findUserById(userId);
        if (current == null) {
            return null;
        }
        session.execute(updateUserAccountStatus.bind(accountStatus, updatedAt, userId));
        BatchStatementBuilder prefixes = BatchStatement.builder(BatchType.UNLOGGED);
        for (String prefix : usernamePrefixes(current.usernameNormalized())) {
            prefixes.addStatement(updateUserPrefixAccountStatus.bind(
                    accountStatus, prefix, current.usernameNormalized(), userId));
        }
        session.execute(prefixes.build());
        return new CanonicalUser(
                current.userId(), current.username(), current.usernameNormalized(), current.email(),
                current.emailNormalized(), current.passwordHash(), current.authProvider(), current.externalSubject(),
                current.displayName(), current.avatarUrl(), accountStatus, current.createdAt(), updatedAt,
                current.lastLoginAt());
    }

    private static List<String> usernamePrefixes(String normalizedUsername) {
        if (normalizedUsername == null || normalizedUsername.length() < 2) {
            return List.of();
        }
        int maxLength = Math.min(20, normalizedUsername.length());
        List<String> prefixes = new ArrayList<>(maxLength - 1);
        for (int length = 2; length <= maxLength; length++) {
            prefixes.add(normalizedUsername.substring(0, length));
        }
        return prefixes;
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
        return session.execute(listCommunityJoinRequests.bind(conversationId, limit)).all().stream()
                .map(this::mapCommunityJoinRequest)
                .map(CommunityJoinRequestRow::toView)
                .toList();
    }

    public boolean claimCommunityJoinResolution(
            UUID conversationId, UUID userId, UUID requestId, UUID actorId, String decision) {
        Instant now = Instant.now();
        boolean applied = session.execute(claimCommunityJoinResolution.bind(
                decision, actorId, now, now, conversationId, userId, requestId)).wasApplied();
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
                status, actorId, now, now, conversationId, userId, requestId)).wasApplied()) {
            throw new IllegalStateException("community join request changed concurrently");
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

    public void banUserInConversation(UUID conversationId, UUID userId, UUID bannedBy, String reasonCode, String reasonText) {
        banUserInConversation(conversationId, userId, bannedBy, reasonCode, reasonText, null);
    }

    public void banUserInConversation(
            UUID conversationId, UUID userId, UUID bannedBy, String reasonCode, String reasonText, Instant expiresAt) {
        session.execute(saveBan.bind(conversationId, userId, bannedBy, reasonCode, reasonText, expiresAt));
        session.execute(saveBanByUser.bind(userId, conversationId, bannedBy, reasonCode, expiresAt));
    }

    public boolean isConversationBanned(UUID conversationId, UUID userId, Instant now) {
        Row row = session.execute(loadConversationBan.bind(conversationId, userId)).one();
        if (row == null) return false;
        Instant expiresAt = row.getInstant("expires_at");
        return expiresAt == null || expiresAt.isAfter(now);
    }

    public void clearConversationBan(UUID conversationId, UUID userId) {
        session.execute(deleteConversationBan.bind(conversationId, userId));
        session.execute(deleteConversationBanByUser.bind(userId, conversationId));
    }

    /**
     * Clears only the timed ban that this expiry worker observed. The CAS
     * prevents a newer ban from being removed by a delayed worker run.
     */
    public boolean clearConversationBanIfExpiresAt(UUID conversationId, UUID userId, Instant expiresAt) {
        if (expiresAt == null) return false;
        if (!session.execute(deleteConversationBanIfExpiresAt.bind(conversationId, userId, expiresAt)).wasApplied()) {
            return false;
        }
        session.execute(deleteConversationBanByUserIfExpiresAt.bind(userId, conversationId, expiresAt));
        return true;
    }

    /** Clears a mute only when the member row still has the observed expiry. */
    public boolean clearMemberMuteIfExpiresAt(UUID conversationId, UUID userId, Instant mutedUntil) {
        if (mutedUntil == null) return false;
        return session.execute(clearMemberMuteIfExpiresAt.bind(conversationId, userId, mutedUntil)).wasApplied();
    }

    // -------- messages --------
    public MessageClaim claimMessage(
            UUID senderId,
            UUID clientMessageId,
            UUID conversationId,
            String bucket,
            String requestFingerprint,
            Instant now) {
        Row existing = session.execute(loadMessageIdByClient.bind(senderId, clientMessageId)).one();
        if (existing != null) {
            return mapMessageClaim(existing, conversationId, requestFingerprint, false);
        }
        UUID messageId = Uuids.timeBased();
        var rs = session.execute(claimMessageIdByClient.bind(
                senderId, clientMessageId, conversationId, bucket, messageId, requestFingerprint, now));
        if (rs.wasApplied()) {
            return new MessageClaim(messageId, bucket, now, true, true);
        }
        Row retry = session.execute(loadMessageIdByClient.bind(senderId, clientMessageId)).one();
        if (retry == null) {
            return null;
        }
        return mapMessageClaim(retry, conversationId, requestFingerprint, false);
    }

    private MessageClaim mapMessageClaim(
            Row row,
            UUID expectedConversationId,
            String expectedRequestFingerprint,
            boolean claimed) {
        boolean matches = expectedConversationId.equals(row.getUuid("conversation_id"))
                && expectedRequestFingerprint.equals(row.getString("request_fingerprint"));
        return new MessageClaim(
                row.getUuid("message_id"),
                row.getString("message_bucket"),
                row.getInstant("created_at"),
                claimed,
                matches);
    }

    public record MessageClaim(
            UUID messageId,
            String messageBucket,
            Instant createdAt,
            boolean claimed,
            boolean matchesRequest) {
    }

    public void insertMessage(CanonicalMessage message, String bucket) {
        session.execute(saveMessage.bind(
                message.conversationId(),
                bucket,
                message.messageId(),
                message.senderId(),
                message.messageType(),
                message.content(),
                message.contentFormat(),
                message.replyToMessageId(),
                message.replyToSenderId(),
                message.stickerId(),
                message.pollId(),
                message.systemEventId(),
                message.forwardedFromConversationId(),
                message.forwardedFromMessageBucket(),
                message.forwardedFromMessageId(),
                message.isDeleted(),
                message.deletedBy(),
                message.deletedAt(),
                message.editedAt(),
                message.hasAttachments(),
                message.hasMentions(),
                message.isPinned(),
                message.createdAt(),
                message.clientMessageId()
        ));
        recordMessageBucket(message);
    }

    public void recordMessageBucket(CanonicalMessage message) {
        Instant bucketHour = message.createdAt().truncatedTo(ChronoUnit.HOURS);
        session.execute(saveMessageBucket.bind(
                message.conversationId(),
                bucketHour,
                message.messageBucket(),
                message.messageId(),
                message.createdAt()));
    }

    public void addMessageAttachment(CanonicalMessage message, CanonicalApiContracts.AttachmentRequest attachment) {
        UdtValue udt = attachmentRefType.newValue()
                .setUuid("attachment_id", attachment.attachmentId())
                .setUuid("asset_id", attachment.assetId())
                .setString("storage_provider", attachment.storageProvider())
                .setString("storage_key", attachment.storageKey())
                .setString("file_name", attachment.fileName())
                .setString("mime_type", attachment.mimeType())
                .setString("thumbnail_url", attachment.thumbnailUrl())
                .setBoolean("is_spoiler", Boolean.TRUE.equals(attachment.isSpoiler()));
        setNullableLong(udt, "byte_size", attachment.byteSize());
        setNullableInt(udt, "width", attachment.width());
        setNullableInt(udt, "height", attachment.height());
        setNullableLong(udt, "duration_ms", attachment.durationMs());

        session.execute(saveAttachment.bind(
                message.conversationId(),
                message.messageBucket(),
                message.messageId(),
                attachment.attachmentId(),
                udt
        ));
    }

    private static void setNullableInt(UdtValue value, String field, Integer fieldValue) {
        if (fieldValue == null) {
            value.setToNull(field);
        } else {
            value.setInt(field, fieldValue);
        }
    }

    private static void setNullableLong(UdtValue value, String field, Long fieldValue) {
        if (fieldValue == null) {
            value.setToNull(field);
        } else {
            value.setLong(field, fieldValue);
        }
    }

    public void upsertMentions(CanonicalMessage message, Set<UUID> mentionedUserIds) {
        BatchStatementBuilder batch = BatchStatement.builder(BatchType.UNLOGGED);
        for (UUID userId : mentionedUserIds) {
            batch.addStatement(saveMentionByMessage.bind(
                    message.conversationId(),
                    message.messageBucket(),
                    message.messageId(),
                    userId
            ));
            batch.addStatement(saveMentionInbox.bind(
                    userId,
                    message.conversationId(),
                    message.messageBucket(),
                    message.messageId(),
                    message.senderId()
            ));
        }
        session.execute(batch.build());
    }

    public CanonicalMessage findMessage(UUID conversationId, String bucket, UUID messageId) {
        Row row = session.execute(loadMessage.bind(conversationId, bucket, messageId)).one();
        return row == null ? null : mapMessage(row);
    }

    public List<CanonicalMessage> listMessagesByBucket(UUID conversationId, String bucket, int limit) {
        return session.execute(listMessagesByBucket.bind(conversationId, bucket, limit)).all().stream()
                .map(this::mapMessage)
                .toList();
    }

    public List<CanonicalMessage> listMessagesByBucketBefore(
            UUID conversationId,
            String bucket,
            UUID beforeMessageId,
            int limit) {
        return session.execute(listMessagesByBucketBefore.bind(
                        conversationId, bucket, beforeMessageId, limit)).all().stream()
                .map(this::mapMessage)
                .toList();
    }

    public List<MessageBucketRow> listMessageBuckets(
            UUID conversationId,
            Instant beforeOrAtHour,
            int limit) {
        var result = beforeOrAtHour == null
                ? session.execute(listMessageBuckets.bind(conversationId, limit))
                : session.execute(listMessageBucketsBefore.bind(conversationId, beforeOrAtHour, limit));
        return result.all().stream()
                .map(row -> new MessageBucketRow(
                        row.getInstant("bucket_hour"),
                        row.getString("message_bucket")))
                .toList();
    }

    public void markMessageRead(
            UUID conversationId,
            String bucket,
            UUID messageId,
            UUID readerId,
            Instant readAt) {
        session.execute(BatchStatement.builder(BatchType.LOGGED)
                .addStatement(updateConversationMemberRead.bind(messageId, readAt, conversationId, readerId))
                .addStatement(saveMessageReadReceipt.bind(conversationId, bucket, messageId, readerId, readAt))
                .addStatement(updateMessageReadBucketSummary.bind(readAt, conversationId, bucket, messageId))
                .build());
    }

    public List<CanonicalApiContracts.MessageReadReceiptView> listMessageReadReceipts(
            UUID conversationId,
            String bucket,
            UUID messageId) {
        return session.execute(listMessageReadReceipts.bind(conversationId, bucket, messageId)).all().stream()
                .map(row -> new CanonicalApiContracts.MessageReadReceiptView(
                        row.getUuid("reader_id"), row.getInstant("read_at")))
                .toList();
    }

    public List<CanonicalApiContracts.MessageRevisionView> listMessageRevisions(
            UUID conversationId,
            String bucket,
            UUID messageId) {
        return session.execute(listMessageRevisions.bind(conversationId, bucket, messageId)).all().stream()
                .map(row -> new CanonicalApiContracts.MessageRevisionView(
                        row.getInt("revision_no"),
                        row.getString("content"),
                        row.getString("action"),
                        row.getUuid("edited_by"),
                        row.getInstant("edited_at")))
                .toList();
    }

    public boolean updateMessageContent(
            UUID conversationId, String bucket, UUID messageId, String content, UUID editedBy) {
        for (int attempt = 0; attempt < 3; attempt++) {
            Row state = session.execute(loadMessageEditState.bind(conversationId, bucket, messageId)).one();
            if (state == null || Boolean.TRUE.equals(state.getBoolean("is_deleted"))) {
                return false;
            }
            int priorRevision = state.isNull("revision_no") ? 0 : state.getInt("revision_no");
            int nextRevision = priorRevision + 1;
            Instant editedAt = Instant.now();
            var updated = session.execute(updateMessageContent.bind(
                    content, editedAt, nextRevision, conversationId, bucket, messageId, priorRevision));
            if (updated.wasApplied()) {
                session.execute(saveMessageRevision.bind(
                        conversationId, bucket, messageId, nextRevision, state.getString("content"),
                        "EDIT", editedBy, editedAt));
                return true;
            }
        }
        return false;
    }

    public boolean deleteMessage(UUID conversationId, String bucket, UUID messageId, UUID deletedBy) {
        for (int attempt = 0; attempt < 3; attempt++) {
            Row state = session.execute(loadMessageEditState.bind(conversationId, bucket, messageId)).one();
            if (state == null || Boolean.TRUE.equals(state.getBoolean("is_deleted"))) {
                return false;
            }
            int priorRevision = state.isNull("revision_no") ? 0 : state.getInt("revision_no");
            int nextRevision = priorRevision + 1;
            Instant deletedAt = Instant.now();
            var deleted = session.execute(updateMessageDeleted.bind(
                    deletedBy, deletedAt, nextRevision, conversationId, bucket, messageId, priorRevision));
            if (deleted.wasApplied()) {
                session.execute(saveMessageRevision.bind(
                        conversationId, bucket, messageId, nextRevision, state.getString("content"),
                        "DELETE", deletedBy, deletedAt));
                return true;
            }
        }
        return false;
    }

    public boolean addReaction(UUID conversationId, String bucket, UUID messageId, UUID userId, String emoji) {
        boolean applied = session.execute(
                saveReaction.bind(conversationId, bucket, messageId, emoji, userId)).wasApplied();
        session.execute(saveReactionBucket.bind(conversationId, bucket, messageId, emoji, userId));
        return applied;
    }

    public boolean removeReaction(UUID conversationId, String bucket, UUID messageId, UUID userId, String emoji) {
        boolean applied = session.execute(
                deleteReaction.bind(conversationId, bucket, messageId, emoji, userId)).wasApplied();
        session.execute(deleteReactionBucket.bind(conversationId, bucket, messageId, emoji, userId));
        return applied;
    }

    public List<CanonicalApiContracts.MessageInteractionView> listMessageInteractions(
            UUID conversationId,
            String bucket,
            List<UUID> messageIds,
            UUID actorId) {
        if (messageIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, Map<String, Long>> countsByMessage = new LinkedHashMap<>();
        Map<UUID, Set<String>> actorReactionsByMessage = new LinkedHashMap<>();
        for (Row row : session.execute(listReactionBucket.bind(conversationId, bucket, messageIds))) {
            UUID messageId = row.getUuid("message_id");
            String emoji = row.getString("emoji");
            countsByMessage
                    .computeIfAbsent(messageId, ignored -> new LinkedHashMap<>())
                    .merge(emoji, 1L, Long::sum);
            if (actorId.equals(row.getUuid("user_id"))) {
                actorReactionsByMessage
                        .computeIfAbsent(messageId, ignored -> new java.util.LinkedHashSet<>())
                        .add(emoji);
            }
        }

        Map<UUID, Instant> latestReadAtByMessage = new LinkedHashMap<>();
        for (Row row : session.execute(listMessageReadBucketSummaries.bind(conversationId, bucket, messageIds))) {
            latestReadAtByMessage.put(row.getUuid("message_id"), row.getInstant("latest_read_at"));
        }

        return messageIds.stream().map(messageId -> {
            Set<String> actorReactions = actorReactionsByMessage.getOrDefault(messageId, Set.of());
            List<CanonicalApiContracts.MessageReactionView> reactions = countsByMessage
                    .getOrDefault(messageId, Map.of())
                    .entrySet()
                    .stream()
                    .map(entry -> new CanonicalApiContracts.MessageReactionView(
                            entry.getKey(), entry.getValue(), actorReactions.contains(entry.getKey())))
                    .toList();
            return new CanonicalApiContracts.MessageInteractionView(
                    messageId, reactions, latestReadAtByMessage.get(messageId));
        }).toList();
    }

    public boolean pinMessage(UUID conversationId, String bucket, UUID messageId, UUID actorId, boolean pin) {
        if (!pin) {
            for (Row row : session.execute(listMessagePinSlots.bind(conversationId)).all()) {
                if (messageId.equals(row.getUuid("message_id"))
                        && bucket != null
                        && bucket.equals(row.getString("message_bucket"))) {
                    session.execute(session.prepare("""
                            DELETE FROM pinned_message_slots_by_conversation
                            WHERE conversation_id = ? AND pin_slot = ?
                            """).bind(conversationId, row.getByte("pin_slot")));
                }
            }
            session.execute(setMessagePinned.bind(false, conversationId, bucket, messageId));
            return true;
        }
        if (isMessageAlreadyPinned(conversationId, bucket, messageId)) {
            session.execute(setMessagePinned.bind(true, conversationId, bucket, messageId));
            return true;
        }
        for (int slot = 0; slot < 5; slot++) {
            var rs = session.execute(claimMessagePinSlot.bind(conversationId, (byte) slot, bucket, messageId, actorId));
            if (rs.wasApplied()) {
                session.execute(setMessagePinned.bind(true, conversationId, bucket, messageId));
                return true;
            }
        }
        return false;
    }

    private boolean isMessageAlreadyPinned(UUID conversationId, String bucket, UUID messageId) {
        for (Row row : session.execute(listMessagePinSlots.bind(conversationId)).all()) {
            if (messageId.equals(row.getUuid("message_id")) && bucket != null && bucket.equals(row.getString("message_bucket"))) {
                return true;
            }
        }
        return false;
    }

    // -------- polls --------
    public void createPoll(CanonicalPoll poll) {
        BatchStatementBuilder batch = BatchStatement.builder(BatchType.LOGGED);
        batch.addStatement(savePoll.bind(
                poll.pollId(),
                poll.conversationId(),
                poll.messageBucket(),
                poll.messageId(),
                poll.question(),
                poll.options(),
                poll.isMultipleChoice(),
                poll.isAnonymous(),
                poll.isClosed(),
                poll.createdBy(),
                poll.createdAt(),
                poll.closesAt(),
                poll.closedBy(),
                poll.closedAt()
        ));
        batch.addStatement(savePollByConversation.bind(
                poll.conversationId(),
                Uuids.startOf(poll.createdAt().toEpochMilli()),
                poll.pollId(),
                poll.messageBucket(),
                poll.messageId(),
                poll.isClosed()
        ));
        batch.addStatement(initializePollState.bind(
                poll.pollId(), new UUID(0L, 0L), Set.of(), poll.createdAt(), emptyPollCounts(poll.options().size())));
        session.execute(batch.build());
    }

    private Map<Integer, Long> emptyPollCounts(int optionCount) {
        Map<Integer, Long> counts = new LinkedHashMap<>();
        for (int index = 0; index < optionCount; index++) {
            counts.put(index, 0L);
        }
        return Map.copyOf(counts);
    }

    public CanonicalPoll findPollById(UUID pollId) {
        Row row = session.execute(loadPollById.bind(pollId)).one();
        return row == null ? null : mapPoll(row);
    }

    public List<CanonicalPoll> findPollsByIds(List<UUID> pollIds) {
        if (pollIds.isEmpty()) {
            return List.of();
        }
        List<CanonicalPoll> polls = new ArrayList<>();
        for (Row row : session.execute(loadPollsById.bind(pollIds))) {
            polls.add(mapPoll(row));
        }
        return List.copyOf(polls);
    }

    public VoteResult votePoll(UUID pollId, UUID voterId, Set<Integer> selectedOptionIndexes) {
        if (selectedOptionIndexes == null || selectedOptionIndexes.isEmpty()) {
            return VoteResult.CONFLICT;
        }
        for (int attempt = 0; attempt < 3; attempt++) {
            PollAggregate aggregate = loadPollAggregate(pollId);
            if (aggregate.isClosed()) {
                return VoteResult.CLOSED;
            }
            Row voteRow = session.execute(loadPollVote.bind(pollId, voterId)).one();
            Set<Integer> prior = voteRow == null
                    ? Set.of()
                    : Set.copyOf(voteRow.getSet("selected_option_indexes", Integer.class));
            if (selectedOptionIndexes.equals(prior)) {
                return VoteResult.IDEMPOTENT;
            }
            Map<Integer, Long> counts = adjustPollCounts(aggregate.optionCounts(), prior, selectedOptionIndexes);
            long totalVoters = aggregate.totalVoters() + (voteRow == null ? 1 : 0);
            BatchStatementBuilder batch = pollAggregateBatch(pollId, aggregate, counts, totalVoters);
            batch.addStatement(voteRow == null
                    ? createPollVote.bind(pollId, voterId, selectedOptionIndexes, Instant.now())
                    : replacePollVote.bind(selectedOptionIndexes, Instant.now(), pollId, voterId, prior));
            if (session.execute(batch.build()).wasApplied()) {
                return voteRow == null ? VoteResult.CREATED : VoteResult.UPDATED;
            }
        }
        return VoteResult.CONFLICT;
    }

    public VoteResult removePollVote(UUID pollId, UUID voterId) {
        for (int attempt = 0; attempt < 3; attempt++) {
            PollAggregate aggregate = loadPollAggregate(pollId);
            if (aggregate.isClosed()) {
                return VoteResult.CLOSED;
            }
            Row voteRow = session.execute(loadPollVote.bind(pollId, voterId)).one();
            if (voteRow == null) {
                return VoteResult.IDEMPOTENT;
            }
            if (aggregate.totalVoters() < 1) {
                throw new IllegalStateException("poll voter total is inconsistent");
            }
            Set<Integer> prior = Set.copyOf(voteRow.getSet("selected_option_indexes", Integer.class));
            Map<Integer, Long> counts = adjustPollCounts(aggregate.optionCounts(), prior, Set.of());
            BatchStatementBuilder batch = pollAggregateBatch(
                    pollId, aggregate, counts, aggregate.totalVoters() - 1);
            batch.addStatement(removePollVote.bind(pollId, voterId, prior));
            if (session.execute(batch.build()).wasApplied()) {
                return VoteResult.REMOVED;
            }
        }
        return VoteResult.CONFLICT;
    }

    private Map<Integer, Long> adjustPollCounts(
            Map<Integer, Long> current,
            Set<Integer> prior,
            Set<Integer> selected) {
        Map<Integer, Long> counts = new LinkedHashMap<>(current);
        for (Integer removed : prior) {
            if (!selected.contains(removed)) {
                Long count = counts.get(removed);
                if (count == null || count < 1) {
                    throw new IllegalStateException("poll option count is inconsistent");
                }
                counts.put(removed, count - 1);
            }
        }
        for (Integer added : selected) {
            if (!prior.contains(added)) {
                counts.merge(added, 1L, Long::sum);
            }
        }
        return Map.copyOf(counts);
    }

    private BatchStatementBuilder pollAggregateBatch(
            UUID pollId,
            PollAggregate aggregate,
            Map<Integer, Long> counts,
            long totalVoters) {
        return BatchStatement.builder(BatchType.LOGGED).addStatement(replacePollAggregate.bind(
                counts, totalVoters, aggregate.version() + 1, pollId, aggregate.version()));
    }

    public Map<UUID, PollState> listPollStates(List<UUID> pollIds, UUID voterId) {
        if (pollIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, PollState> states = new LinkedHashMap<>();
        for (Row row : session.execute(loadPollAggregates.bind(pollIds))) {
            UUID pollId = row.getUuid("poll_id");
            states.put(pollId, new PollState(readPollCounts(row), Set.of(), row.getLong("total_voters")));
        }
        for (Row row : session.execute(loadPollVotes.bind(pollIds, voterId))) {
            UUID pollId = row.getUuid("poll_id");
            PollState state = states.get(pollId);
            if (state != null) {
                states.put(pollId, new PollState(
                        state.optionCounts(),
                        Set.copyOf(row.getSet("selected_option_indexes", Integer.class)),
                        state.totalVoters()));
            }
        }
        return Map.copyOf(states);
    }

    private PollAggregate loadPollAggregate(UUID pollId) {
        Row row = session.execute(loadPollAggregate.bind(pollId)).one();
        if (row == null) {
            throw new IllegalStateException("poll aggregate is missing");
        }
        return new PollAggregate(
                readPollCounts(row), row.getLong("total_voters"), row.getLong("aggregate_version"),
                row.getBoolean("is_closed"));
    }

    private Map<Integer, Long> readPollCounts(Row row) {
        Map<Integer, Long> counts = row.getMap("option_counts", Integer.class, Long.class);
        if (counts == null) {
            throw new IllegalStateException("poll option counts are missing");
        }
        return Map.copyOf(counts);
    }

    private record PollAggregate(
            Map<Integer, Long> optionCounts,
            long totalVoters,
            long version,
            boolean isClosed) {
    }

    public record PollState(Map<Integer, Long> optionCounts, Set<Integer> currentUserOptionIndexes, long totalVoters) {
    }

    public boolean closePoll(CanonicalPoll poll, UUID actorId, Instant closedAt) {
        boolean stateClosed = session.execute(closePollState.bind(poll.pollId())).wasApplied();
        boolean metadataClosed = session.execute(closePoll.bind(actorId, closedAt, poll.pollId())).wasApplied();
        if (metadataClosed) {
            session.execute(closePollProjection.bind(
                    poll.conversationId(), Uuids.startOf(poll.createdAt().toEpochMilli()), poll.pollId()));
        }
        return stateClosed || metadataClosed;
    }

    public enum VoteResult { CREATED, UPDATED, REMOVED, IDEMPOTENT, CLOSED, CONFLICT }

    // -------- invites --------
    public void createInvite(CanonicalInviteLink invite) {
        session.execute(createInvite.bind(
                invite.linkToken(),
                invite.linkId(),
                invite.conversationId(),
                invite.createdBy(),
                invite.createdAt(),
                invite.inviteKind(),
                invite.joinPolicy(),
                invite.displayName(),
                invite.expiresAt(),
                invite.isActive(),
                invite.maxUses()
        ));
        session.execute(session.prepare("""
                INSERT INTO invitation_links_by_conversation
                    (conversation_id, created_at, link_id, link_token, created_by, invite_kind,
                     join_policy, display_name, expires_at, is_active, max_uses, used_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """).bind(
                invite.conversationId(),
                invite.linkId(),
                invite.linkId(),
                invite.linkToken(),
                invite.createdBy(),
                invite.inviteKind(),
                invite.joinPolicy(),
                invite.displayName(),
                invite.expiresAt(),
                invite.isActive(),
                invite.maxUses()
        ));
    }

    public List<CanonicalInviteLink> listInviteByConversation(UUID conversationId, int limit) {
        return session.execute(listInvitesByConversation.bind(conversationId, limit)).all().stream()
                .map(this::mapInvite)
                .collect(Collectors.toList());
    }

    public CanonicalInviteLink findInviteByToken(String token) {
        Row row = session.execute(loadInviteByToken.bind(token)).one();
        return row == null ? null : mapInvite(row);
    }

    public String findInviteJoinStatus(UUID linkId, UUID userId) {
        Row row = session.execute(loadInviteJoin.bind(linkId, userId)).one();
        return row == null ? null : row.getString("status");
    }

    public InviteConsumeResult consumeInvite(String token, UUID userId) {
        CanonicalInviteLink invite = findInviteByToken(token);
        if (invite == null) {
            return InviteConsumeResult.RETRY_REQUIRED;
        }
        if (!Boolean.TRUE.equals(invite.isActive())) {
            return InviteConsumeResult.RETRY_REQUIRED;
        }
        if (invite.expiresAt() != null && invite.expiresAt().isBefore(Instant.now())) {
            session.execute(deactivateInvite.bind(userId, Instant.now(), token));
            return InviteConsumeResult.RETRY_REQUIRED;
        }
        Instant now = Instant.now();
        if (!claimInviteJoinForRetry(invite.linkId(), userId, UUID.randomUUID(), now)) {
            Row existingJoin = session.execute(loadInviteJoin.bind(invite.linkId(), userId)).one();
            return existingJoin != null && "ACCEPTED".equals(existingJoin.getString("status"))
                    ? InviteConsumeResult.ALREADY_ACCEPTED
                    : InviteConsumeResult.RETRY_REQUIRED;
        }
        int current = invite.usedCount() == null ? 0 : invite.usedCount();
        Integer max = invite.maxUses();
        if (max != null && current >= max) {
            session.execute(deactivateInvite.bind(userId, Instant.now(), token));
            session.execute(updateInviteJoinStatus.bind("FAILED", Instant.now(), invite.linkId(), userId));
            return InviteConsumeResult.RETRY_REQUIRED;
        }
        int next = current + 1;
        boolean stillActive = max == null || next < max;
        var lwt = session.execute(updateInviteUseCount.bind(
                next,
                stillActive,
                token,
                current
        ));
        if (!lwt.wasApplied()) {
            session.execute(updateInviteJoinStatus.bind("FAILED", Instant.now(), invite.linkId(), userId));
            return InviteConsumeResult.RETRY_REQUIRED;
        }
        session.execute(updateInviteProjectionUseCount.bind(
                next, stillActive, invite.conversationId(), invite.linkId(), invite.linkId()));
        session.execute(recordInviteJoin.bind(invite.linkId(), userId, "ACCEPTED", null));
        session.execute(updateInviteJoinStatus.bind("ACCEPTED", Instant.now(), invite.linkId(), userId));
        return InviteConsumeResult.CONSUMED;
    }

    public String requestInviteApproval(CanonicalInviteLink invite, UUID userId) {
        Instant now = Instant.now();
        UUID requestId = UUID.randomUUID();
        if (!claimInviteJoinForRetry(invite.linkId(), userId, requestId, now)) {
            Row existing = session.execute(loadInviteJoin.bind(invite.linkId(), userId)).one();
            return existing == null ? "FAILED" : existing.getString("status");
        }
        session.execute(saveJoinRequest.bind(
                invite.conversationId(), requestId, userId, invite.linkId(), invite.linkToken()));
        session.execute(recordInviteJoin.bind(invite.linkId(), userId, "PENDING", null));
        return "PENDING";
    }

    private boolean claimInviteJoinForRetry(UUID linkId, UUID userId, UUID requestId, Instant now) {
        if (session.execute(claimInviteJoin.bind(
                linkId, userId, requestId, "PENDING", now, now)).wasApplied()) {
            return true;
        }
        return session.execute(reclaimFailedInviteJoin.bind(requestId, now, linkId, userId)).wasApplied();
    }

    public void recordInviteOutcome(CanonicalInviteLink invite, UUID userId, String outcome) {
        session.execute(recordInviteJoin.bind(invite.linkId(), userId, outcome, null));
    }

    public boolean declineInvite(CanonicalInviteLink invite, UUID userId) {
        Row existing = session.execute(loadInviteJoin.bind(invite.linkId(), userId)).one();
        if (existing != null && "ACCEPTED".equals(existing.getString("status"))) {
            return false;
        }
        Instant now = Instant.now();
        if (existing == null) {
            var claimed = session.execute(claimInviteJoin.bind(
                    invite.linkId(), userId, UUID.randomUUID(), "DECLINED", now, now));
            if (!claimed.wasApplied()) {
                return false;
            }
        } else {
            session.execute(updateInviteJoinStatus.bind("DECLINED", now, invite.linkId(), userId));
        }
        recordInviteOutcome(invite, userId, "DECLINED");
        return true;
    }

    public List<CanonicalApiContracts.JoinRequestView> listJoinRequests(UUID conversationId, int limit) {
        return session.execute(listJoinRequests.bind(conversationId, limit)).all().stream()
                .map(row -> new CanonicalApiContracts.JoinRequestView(
                        row.getUuid("conversation_id"), row.getUuid("requested_at"), row.getUuid("request_id"),
                        row.getUuid("user_id"), row.getUuid("link_id"), row.getString("status"),
                        row.getUuid("resolved_by"), row.getInstant("resolved_at")))
                .toList();
    }

    public Row findJoinRequest(UUID conversationId, UUID requestedAt, UUID requestId) {
        return session.execute(loadJoinRequest.bind(conversationId, requestedAt, requestId)).one();
    }

    public boolean claimJoinRequestResolution(
            UUID conversationId, UUID requestedAt, UUID requestId, UUID actorId, String decision) {
        return session.execute(claimJoinRequestResolution.bind(
                decision, actorId, Instant.now(), conversationId, requestedAt, requestId)).wasApplied();
    }

    public void finishJoinRequestResolution(
            UUID conversationId, UUID requestedAt, UUID requestId, String status, UUID actorId) {
        session.execute(finishJoinRequestResolution.bind(
                status, actorId, Instant.now(), conversationId, requestedAt, requestId));
    }

    public boolean reserveInviteUse(CanonicalInviteLink invite) {
        int current = invite.usedCount() == null ? 0 : invite.usedCount();
        if (invite.maxUses() != null && current >= invite.maxUses()) {
            return false;
        }
        int next = current + 1;
        boolean stillActive = invite.maxUses() == null || next < invite.maxUses();
        var reserved = session.execute(updateInviteUseCount.bind(
                next, stillActive, invite.linkToken(), current));
        if (!reserved.wasApplied()) {
            return false;
        }
        session.execute(updateInviteProjectionUseCount.bind(
                next, stillActive, invite.conversationId(), invite.linkId(), invite.linkId()));
        return true;
    }

    public void releaseInviteUse(CanonicalInviteLink invite, UUID userId) {
        for (int attempt = 0; attempt < 5; attempt++) {
            CanonicalInviteLink current = findInviteByToken(invite.linkToken());
            int usedCount = current == null || current.usedCount() == null ? 0 : current.usedCount();
            if (current == null || usedCount == 0) {
                session.execute(updateInviteJoinStatus.bind("FAILED", Instant.now(), invite.linkId(), userId));
                return;
            }
            int nextCount = usedCount - 1;
            boolean active = current.revokedAt() == null
                    && (current.expiresAt() == null || current.expiresAt().isAfter(Instant.now()));
            if (!session.execute(updateInviteUseCount.bind(
                    nextCount, active, current.linkToken(), usedCount)).wasApplied()) {
                continue;
            }
            session.execute(updateInviteProjectionUseCount.bind(
                    nextCount, active, current.conversationId(), current.linkId(), current.linkId()));
            session.execute(updateInviteJoinStatus.bind("FAILED", Instant.now(), invite.linkId(), userId));
            return;
        }
        throw new IllegalStateException("invite usage changed concurrently; reconciliation required");
    }

    public void markInviteJoinAccepted(CanonicalInviteLink invite, UUID userId) {
        session.execute(updateInviteJoinStatus.bind("ACCEPTED", Instant.now(), invite.linkId(), userId));
        recordInviteOutcome(invite, userId, "ACCEPTED");
    }

    public void markInviteJoinFailed(CanonicalInviteLink invite, UUID userId) {
        session.execute(updateInviteJoinStatus.bind("FAILED", Instant.now(), invite.linkId(), userId));
    }

    public enum InviteConsumeResult {
        CONSUMED,
        ALREADY_ACCEPTED,
        RETRY_REQUIRED
    }

    public void revokeInvite(CanonicalInviteLink invite, UUID actorId) {
        Instant now = Instant.now();
        session.execute(deactivateInvite.bind(actorId, now, invite.linkToken()));
        session.execute(updateInviteProjectionUseCount.bind(
                invite.usedCount() == null ? 0 : invite.usedCount(), false,
                invite.conversationId(), invite.linkId(), invite.linkId()));
    }

    // -------- notifications / preferences --------
    public CanonicalNotificationSettings readNotificationSetting(UUID userId) {
        Row row = session.execute(getNotificationSetting.bind(userId)).one();
        return row == null ? null : mapNotificationSetting(row);
    }

    public void saveNotificationSetting(CanonicalNotificationSettings setting) {
        session.execute(saveNotificationSetting.bind(
                setting.userId(),
                setting.globalLevel(),
                setting.pushEnabled(),
                setting.emailEnabled(),
                setting.desktopEnabled(),
                setting.soundEnabled(),
                setting.quietHoursStart(),
                setting.quietHoursEnd(),
                setting.timezone(),
                Instant.now()
        ));
    }

    public CanonicalChatPreferences readChatPreferences(UUID userId) {
        Row row = session.execute(getChatPreferences.bind(userId)).one();
        return row == null ? null : mapChatPreferences(row);
    }

    public void saveChatPreferences(CanonicalChatPreferences preferences) {
        session.execute(saveChatPreferences.bind(
                preferences.userId(),
                preferences.defaultThemeId(),
                preferences.defaultBubbleStyleId(),
                preferences.defaultBackgroundAssetId(),
                preferences.updatedAt()));
    }

    public List<CanonicalConversationPreferences> listConversationPreferences(UUID userId, int limit) {
        return session.execute(listConversationPreferencesByUser.bind(userId, limit)).all().stream()
                .map(this::mapConversationPreferences)
                .toList();
    }

    public void saveConversationPreferences(CanonicalConversationPreferences preferences) {
        session.execute(saveConversationPreferences.bind(
                preferences.userId(),
                preferences.conversationId(),
                preferences.themeId(),
                preferences.bubbleStyleId(),
                preferences.backgroundAssetId(),
                preferences.customBackgroundUrl(),
                preferences.updatedAt()));
    }

    public void deleteConversationPreferences(UUID userId, UUID conversationId) {
        session.execute(deleteConversationPreferences.bind(userId, conversationId));
    }

    public List<CanonicalNotification> listNotifications(UUID userId, String month, int limit) {
        return session.execute(listNotificationsByMonth.bind(userId, month, limit)).all().stream()
                .map(this::mapNotification)
                .toList();
    }

    public void markNotificationRead(UUID userId, String month, UUID notificationId) {
        session.execute(markNotificationAsRead.bind(Instant.now(), userId, month, notificationId));
    }

    public void deleteNotification(UUID userId, String month, UUID notificationId) {
        session.execute(deleteNotification.bind(userId, month, notificationId));
    }

    // -------- audit / analytics --------
    public void saveRoomEvent(CanonicalRoomAuditEvent event) {
        session.execute(saveRoomEvent.bind(
                event.conversationId(),
                event.eventMonth(),
                event.eventId(),
                event.action(),
                event.actorId(),
                event.targetUserId(),
                null,
                null,
                event.reasonCode(),
                roomEventMetadata(event.beforeState(), event.afterState()),
                event.createdAt()
        ));
        String metricType = analyticsEventType(event.action());
        if (metricType != null) {
            session.execute(saveAnalytics.bind(
                    event.createdAt().atZone(ZoneOffset.UTC).toLocalDate(),
                    metricType,
                    (byte) Math.floorMod(
                            (event.actorId() == null ? event.eventId() : event.actorId()).hashCode(), 16),
                    event.eventId(),
                    event.actorId(),
                    event.conversationId(),
                    event.beforeState() == null ? Map.of() : event.beforeState()
            ));
        }
    }

    private Map<String, String> roomEventMetadata(
            Map<String, String> beforeState,
            Map<String, String> afterState) {
        Map<String, String> metadata = new LinkedHashMap<>();
        if (beforeState != null) {
            beforeState.forEach((key, value) -> metadata.put("before." + key, value));
        }
        if (afterState != null) {
            afterState.forEach((key, value) -> metadata.put("after." + key, value));
        }
        return Map.copyOf(metadata);
    }

    public List<CanonicalRoomEvent> listRoomEvents(
            UUID conversationId,
            String eventMonth,
            UUID beforeEventId,
            int limit) {
        var statement = beforeEventId == null
                ? listRoomEvents.bind(conversationId, eventMonth, limit)
                : listRoomEventsBefore.bind(conversationId, eventMonth, beforeEventId, limit);
        return session.execute(statement).all().stream().map(row -> new CanonicalRoomEvent(
                row.getUuid("conversation_id"),
                row.getString("event_month"),
                row.getUuid("event_id"),
                row.getString("event_type"),
                row.getUuid("actor_id"),
                row.getUuid("target_user_id"),
                row.getString("message_bucket"),
                row.getUuid("message_id"),
                row.getString("reason_code"),
                row.getMap("metadata", String.class, String.class),
                row.getInstant("created_at"))).toList();
    }

    /**
     * Keep the analytics contract stable while audit actions remain descriptive
     * and may evolve independently. Actions without a product metric are not
     * written to the aggregate table.
     */
    private String analyticsEventType(String action) {
        return switch (action) {
            case "CONVERSATION_CREATE" -> "ROOM_CREATED";
            case "JOIN_BY_INVITE", "JOIN_REQUEST_APPROVE" -> "ROOM_JOINED";
            case "MESSAGE_SEND" -> "MESSAGE_SENT";
            case "POLL_CREATE" -> "POLLS_CREATED";
            case "POLL_VOTE", "POLL_VOTE_CHANGE" -> "POLL_VOTED";
            case "CALL_START" -> "CALL_STARTED";
            default -> null;
        };
    }

    public void saveAuditEvent(CanonicalRoomAuditEvent event) {
        session.execute(saveAuditByActor.bind(
                event.actorId(), event.eventMonth(), event.eventId(), event.action(),
                event.resourceType(), event.resourceId(), event.conversationId(), event.targetUserId(),
                event.outcome(), event.reasonCode(), event.beforeState(), event.afterState(),
                event.requestId(), event.ipHash(), event.userAgentHash(), event.createdAt()));
        session.execute(saveAuditByResource.bind(
                event.resourceType(), event.resourceId(), event.eventMonth(), event.eventId(),
                event.actorId(), event.action(), event.outcome(), event.createdAt()));
        session.execute(saveAuditByMonth.bind(
                event.eventMonth(), event.eventId(), event.action(), event.resourceType(), event.resourceId(),
                event.actorId(), event.conversationId(), event.targetUserId(), event.outcome(), event.reasonCode(),
                event.beforeState(), event.afterState(), event.requestId(), event.createdAt()));
    }

    public List<AuditEventRow> listAuditEvents(String month, int limit) {
        String partition = month == null || month.isBlank()
                ? java.time.YearMonth.now(ZoneOffset.UTC).toString() : month;
        int boundedLimit = Math.max(1, Math.min(limit, 200));
        return session.execute(listAuditByMonth.bind(partition, boundedLimit)).all().stream()
                .map(row -> new AuditEventRow(
                        row.getString("event_month"),
                        row.getUuid("event_id"),
                        row.getString("action"),
                        row.getString("resource_type"),
                        row.getString("resource_id"),
                        row.getUuid("actor_id"),
                        row.getUuid("conversation_id"),
                        row.getUuid("target_user_id"),
                        row.getString("outcome"),
                        row.getString("reason_code"),
                        row.getMap("before_state", String.class, String.class),
                        row.getMap("after_state", String.class, String.class),
                        row.getUuid("request_id"),
                        row.getInstant("created_at")))
                .toList();
    }

    public void saveOutboxEvent(
            String partition,
            UUID eventId,
            String aggregateType,
            String aggregateId,
            String eventType,
            String payloadJson,
            Instant createdAt) {
        BatchStatementBuilder batch = BatchStatement.builder(BatchType.LOGGED);
        batch.addStatement(saveOutboxEvent.bind(
                partition, eventId, aggregateType, aggregateId, eventType, payloadJson, createdAt));
        batch.addStatement(savePendingOutboxEvent.bind(
                partition, eventId, aggregateType, aggregateId, eventType, payloadJson, createdAt));
        session.execute(batch.build());
    }

    public List<OutboxEvent> listUnpublishedOutboxEvents(String partition, int limit) {
        int boundedLimit = Math.max(1, Math.min(1000, limit));
        return session.execute(listPendingOutboxEvents.bind(partition, boundedLimit)).all().stream()
                .map(row -> new OutboxEvent(
                        row.getString("outbox_partition"),
                        row.getUuid("event_id"),
                        row.getString("aggregate_type"),
                        row.getString("aggregate_id"),
                        row.getString("event_type"),
                        row.getString("payload_json"),
                        row.getInstant("created_at"),
                        null,
                        row.getInt("publish_attempts")))
                .toList();
    }

    public void markOutboxPublishAttempt(OutboxEvent event, Instant publishedAt) {
        int nextAttempts = event.publishAttempts() + 1;
        BatchStatementBuilder batch = BatchStatement.builder(BatchType.LOGGED);
        batch.addStatement(markOutboxEvent.bind(
                publishedAt,
                nextAttempts,
                event.outboxPartition(),
                event.eventId()));
        if (publishedAt == null) {
            batch.addStatement(markPendingOutboxEvent.bind(
                    nextAttempts,
                    event.outboxPartition(),
                    event.eventId()));
        } else {
            batch.addStatement(deletePendingOutboxEvent.bind(
                    event.outboxPartition(),
                    event.eventId()));
        }
        session.execute(batch.build());
    }

    public record OutboxEvent(
            String outboxPartition,
            UUID eventId,
            String aggregateType,
            String aggregateId,
            String eventType,
            String payloadJson,
            Instant createdAt,
            Instant publishedAt,
            int publishAttempts) {
    }

    public record AuditEventRow(
            String eventMonth,
            UUID eventId,
            String action,
            String resourceType,
            String resourceId,
            UUID actorId,
            UUID conversationId,
            UUID targetUserId,
            String outcome,
            String reasonCode,
            Map<String, String> beforeState,
            Map<String, String> afterState,
            UUID requestId,
            Instant createdAt) {
    }

    public List<CanonicalAnalyticsPoint> listAnalytics(LocalDate day, String eventType, int limit) {
        int boundedLimit = Math.max(1, Math.min(2_000, limit));
        if ("ALL".equalsIgnoreCase(eventType)) {
            List<CanonicalAnalyticsPoint> out = new ArrayList<>();
            String[] defaultEventTypes = {"ROOM_CREATED", "ROOM_JOINED", "MESSAGE_SENT", "POLLS_CREATED", "POLL_VOTED", "CALL_STARTED"};
            for (String type : defaultEventTypes) {
                for (int shard = 0; shard < 16; shard++) {
                    int remaining = boundedLimit - out.size();
                    if (remaining <= 0) {
                        return out;
                    }
                    out.addAll(session.execute(listAnalyticsByType.bind(
                                    day, type, (byte) shard, remaining / defaultEventTypes.length + 1)).all().stream()
                            .map(this::mapAnalyticsPoint)
                            .collect(Collectors.toList()));
                }
            }
            return out;
        }
        List<CanonicalAnalyticsPoint> out = new ArrayList<>();
        for (int shard = 0; shard < 16 && out.size() < boundedLimit; shard++) {
            int remaining = boundedLimit - out.size();
            out.addAll(session.execute(listAnalyticsByType.bind(day, eventType, (byte) shard, remaining)).all().stream()
                    .map(this::mapAnalyticsPoint)
                    .toList());
        }
        return out.stream().limit(boundedLimit).toList();
    }

    // -------- additional admin/utility operations --------
    public void upsertNotification(CanonicalNotification notification) {
        session.execute(upsertNotification.bind(
                notification.userId(),
                notification.notificationMonth(),
                notification.notificationId(),
                notification.notificationType(),
                notification.priority(),
                notification.conversationId(),
                notification.messageBucket(),
                notification.messageId(),
                notification.actorId(),
                notification.title(),
                notification.bodyPreview(),
                notification.deepLink(),
                notification.actionPayload(),
                notification.isRead(),
                notification.readAt(),
                notification.createdAt()
        ));
    }

    public void deleteNotificationsByMonth(UUID userId, String month) {
        session.execute(deleteNotificationsByMonth.bind(userId, month));
    }

    // -------- mapping --------
    private CanonicalUser mapUser(Row row) {
        return new CqlCanonicalRecords.CanonicalUser(
                row.getUuid("user_id"),
                row.getString("username"),
                row.getString("username_normalized"),
                row.getString("email"),
                row.getString("email_normalized"),
                row.getString("password_hash"),
                row.getString("auth_provider"),
                row.getString("external_subject"),
                row.getString("display_name"),
                row.getString("avatar_url"),
                row.getString("account_status"),
                row.getInstant("created_at"),
                row.getInstant("updated_at"),
                row.getInstant("last_login_at")
        );
    }

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

    private CanonicalMessage mapMessage(Row row) {
        return new CanonicalMessage(
                row.getUuid("conversation_id"),
                row.getString("message_bucket"),
                row.getUuid("message_id"),
                row.getUuid("sender_id"),
                row.getString("message_type"),
                row.getString("content"),
                row.getString("content_format"),
                row.getUuid("reply_to_message_id"),
                row.getUuid("reply_to_sender_id"),
                row.getUuid("sticker_id"),
                row.getUuid("poll_id"),
                row.getUuid("system_event_id"),
                row.getUuid("forwarded_from_conversation_id"),
                row.getString("forwarded_from_message_bucket"),
                row.getUuid("forwarded_from_message_id"),
                row.getBoolean("is_deleted"),
                row.getUuid("deleted_by"),
                row.getInstant("deleted_at"),
                row.getInstant("edited_at"),
                row.getBoolean("has_attachments"),
                row.getBoolean("has_mentions"),
                row.getBoolean("is_pinned"),
                row.getInstant("created_at"),
                row.getUuid("client_message_id")
        );
    }

    private CanonicalPoll mapPoll(Row row) {
        return new CqlCanonicalRecords.CanonicalPoll(
                row.getUuid("poll_id"),
                row.getUuid("conversation_id"),
                row.getString("message_bucket"),
                row.getUuid("message_id"),
                row.getString("question"),
                row.getList("options", String.class),
                row.getBoolean("is_multiple_choice"),
                row.getBoolean("is_anonymous"),
                row.getBoolean("is_closed"),
                row.getUuid("created_by"),
                row.getInstant("created_at"),
                row.getInstant("closes_at"),
                row.getUuid("closed_by"),
                row.getInstant("closed_at")
        );
    }

    private CanonicalInviteLink mapInvite(Row row) {
        return new CanonicalInviteLink(
                row.getUuid("link_id"),
                row.getString("link_token"),
                row.getUuid("conversation_id"),
                row.getUuid("created_by"),
                inviteCreatedAt(row),
                row.getString("invite_kind"),
                row.getString("join_policy"),
                row.getString("display_name"),
                row.getInstant("expires_at"),
                row.getBoolean("is_active"),
                row.getInt("max_uses"),
                row.getInt("used_count"),
                row.getUuid("revoked_by"),
                row.getInstant("revoked_at")
        );
    }

    private Instant inviteCreatedAt(Row row) {
        Object raw = row.getObject("created_at");
        if (raw instanceof UUID timeUuid) {
            return Instant.ofEpochMilli(Uuids.unixTimestamp(timeUuid));
        }
        return row.getInstant("created_at");
    }

    private CanonicalNotification mapNotification(Row row) {
        return new CanonicalNotification(
                row.getUuid("user_id"),
                row.getString("notification_month"),
                row.getUuid("notification_id"),
                row.getString("notification_type"),
                row.getString("priority"),
                row.getUuid("conversation_id"),
                row.getString("message_bucket"),
                row.getUuid("message_id"),
                row.getUuid("actor_id"),
                row.getString("title"),
                row.getString("body_preview"),
                row.getString("deep_link"),
                row.getMap("action_payload", String.class, String.class),
                row.getBoolean("is_read"),
                row.getInstant("read_at"),
                row.getInstant("created_at")
        );
    }

    private CanonicalNotificationSettings mapNotificationSetting(Row row) {
        return new CanonicalNotificationSettings(
                row.getUuid("user_id"),
                row.getString("global_level"),
                row.getBoolean("push_enabled"),
                row.getBoolean("email_enabled"),
                row.getBoolean("desktop_enabled"),
                row.getBoolean("sound_enabled"),
                row.getString("quiet_hours_start"),
                row.getString("quiet_hours_end"),
                row.getString("timezone"),
                row.getInstant("updated_at")
        );
    }

    private CanonicalChatPreferences mapChatPreferences(Row row) {
        return new CanonicalChatPreferences(
                row.getUuid("user_id"),
                row.getString("default_theme_id"),
                row.getString("default_bubble_style_id"),
                row.getString("default_background_asset_id"),
                row.getInstant("updated_at")
        );
    }

    private CanonicalConversationPreferences mapConversationPreferences(Row row) {
        return new CanonicalConversationPreferences(
                row.getUuid("user_id"),
                row.getUuid("conversation_id"),
                row.getString("theme_id"),
                row.getString("bubble_style_id"),
                row.getString("background_asset_id"),
                row.getString("custom_background_url"),
                row.getInstant("updated_at")
        );
    }

    private CanonicalAnalyticsPoint mapAnalyticsPoint(Row row) {
        return new CanonicalAnalyticsPoint(
                row.getLocalDate("event_day"),
                row.getString("event_type"),
                (int) row.getByte("event_shard"),
                row.getUuid("event_id"),
                row.getUuid("actor_id"),
                row.getUuid("conversation_id"),
                row.getMap("dimensions", String.class, String.class)
        );
    }

    private CommunityJoinRequestRow mapCommunityJoinRequest(Row row) {
        return new CommunityJoinRequestRow(
                row.getUuid("conversation_id"), row.getUuid("user_id"), row.getUuid("request_id"),
                row.getUuid("requested_at"), row.getString("status"), row.getString("reason"),
                row.getString("resolution_decision"), row.getUuid("resolved_by"), row.getInstant("resolved_at"));
    }

    public record UserDirectoryRow(
            String usernameNormalized,
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            String accountStatus) {
    }

    public record RefreshTokenOwnerRow(
            UUID tokenId,
            UUID userId,
            String tokenHash,
            Instant expiresAt,
            Instant revokedAt) {
    }

    public record RefreshTokenSessionRow(
            UUID tokenId,
            UUID issuedAt,
            UUID deviceId,
            Instant expiresAt,
            Instant revokedAt,
            UUID replacedByTokenId) {
    }

    public record DeviceSessionRow(
            UUID deviceId,
            String platform,
            String pushProvider,
            String deviceName,
            String appVersion,
            boolean active,
            Instant createdAt,
            Instant lastSeenAt) {
    }

    public record MessageBucketRow(Instant bucketHour, String messageBucket) {
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
