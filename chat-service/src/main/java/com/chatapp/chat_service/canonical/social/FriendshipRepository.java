package com.chatapp.chat_service.canonical.social;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Cassandra access patterns for friendship, request, and social block tables. */
@Repository
public class FriendshipRepository {
    private final CqlSession session;
    private final PreparedStatement claimRequest;
    private final PreparedStatement loadRequest;
    private final PreparedStatement resetRequestToPending;
    private final PreparedStatement updateRequestStatus;
    private final PreparedStatement forceUpdateRequestStatus;
    private final PreparedStatement saveRequestInbox;
    private final PreparedStatement deleteRequestInbox;
    private final PreparedStatement listIncomingRequests;
    private final PreparedStatement listFriendshipByStatus;
    private final PreparedStatement insertFriendshipProjection;
    private final PreparedStatement deleteFriendshipProjection;
    private final PreparedStatement findProjectionKey;
    private final PreparedStatement saveProjectionKey;
    private final PreparedStatement deleteProjectionKey;
    private final PreparedStatement loadFriendshipByPair;
    private final PreparedStatement saveFriendshipByPair;
    private final PreparedStatement updateFriendshipRemoved;
    private final PreparedStatement findBlockRow;
    private final PreparedStatement insertBlock;
    private final PreparedStatement insertBlockReverse;
    private final PreparedStatement deleteBlock;
    private final PreparedStatement deleteBlockReverse;
    private final PreparedStatement findBlockReverse;
    private final PreparedStatement listBlockedByActor;
    private final PreparedStatement listBlockedByUser;

    public FriendshipRepository(CqlSession session) {
        this.session = session;
        this.claimRequest = session.prepare("""
                INSERT INTO friend_request_by_pair
                    (requester_id, recipient_id, requested_at, message, status, resolved_at)
                VALUES (?, ?, ?, ?, 'PENDING', null)
                IF NOT EXISTS
                """);
        this.loadRequest = session.prepare("""
                SELECT * FROM friend_request_by_pair
                WHERE requester_id = ? AND recipient_id = ?
                """);
        this.resetRequestToPending = session.prepare("""
                UPDATE friend_request_by_pair
                SET status='PENDING', requested_at=?, message=?, resolved_at=null
                WHERE requester_id=? AND recipient_id=? IF status IN ('DECLINED', 'CANCELLED')
                """);
        this.updateRequestStatus = session.prepare("""
                UPDATE friend_request_by_pair
                SET status=?, resolved_at=?
                WHERE requester_id=? AND recipient_id=? IF status='PENDING'
                """);
        this.forceUpdateRequestStatus = session.prepare("""
                UPDATE friend_request_by_pair
                SET status=?, resolved_at=?
                WHERE requester_id=? AND recipient_id=?
                """);
        this.saveRequestInbox = session.prepare("""
                INSERT INTO friend_requests_by_recipient
                    (recipient_id, requested_at, requester_id, message)
                VALUES (?, ?, ?, ?)
                """);
        this.deleteRequestInbox = session.prepare("""
                DELETE FROM friend_requests_by_recipient
                WHERE recipient_id = ? AND requested_at = ? AND requester_id = ?
                """);
        this.listIncomingRequests = session.prepare("""
                SELECT requested_at, requester_id, message
                FROM friend_requests_by_recipient
                WHERE recipient_id = ? LIMIT ?
                """);
        this.listFriendshipByStatus = session.prepare("""
                SELECT other_user_id, requested_at, accepted_at, updated_at, relationship_status
                FROM friendships_by_user
                WHERE user_id = ? AND relationship_status = ? LIMIT ?
                """);
        this.insertFriendshipProjection = session.prepare("""
                INSERT INTO friendships_by_user
                    (user_id, relationship_status, updated_at, other_user_id, requested_at, accepted_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
        this.deleteFriendshipProjection = session.prepare("""
                DELETE FROM friendships_by_user
                WHERE user_id = ? AND relationship_status = ? AND updated_at = ? AND other_user_id = ?
                """);
        this.findProjectionKey = session.prepare("""
                SELECT relationship_status, updated_at
                FROM friendship_projection_key_by_pair_user
                WHERE user_id = ? AND other_user_id = ?
                """);
        this.saveProjectionKey = session.prepare("""
                INSERT INTO friendship_projection_key_by_pair_user
                    (user_id, other_user_id, relationship_status, updated_at)
                VALUES (?, ?, ?, ?)
                """);
        this.deleteProjectionKey = session.prepare("""
                DELETE FROM friendship_projection_key_by_pair_user
                WHERE user_id = ? AND other_user_id = ?
                """);
        this.loadFriendshipByPair = session.prepare("""
                SELECT * FROM friendship_by_pair
                WHERE user_low_id = ? AND user_high_id = ?
                """);
        this.saveFriendshipByPair = session.prepare("""
                INSERT INTO friendship_by_pair
                    (user_low_id, user_high_id, status, requested_by, requested_at, accepted_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """);
        this.updateFriendshipRemoved = session.prepare("""
                UPDATE friendship_by_pair
                SET status='REMOVED', updated_at=?
                WHERE user_low_id=? AND user_high_id=? IF status='ACCEPTED'
                """);
        this.findBlockRow = session.prepare("""
                SELECT created_at, reason_text
                FROM user_blocks_by_blocker
                WHERE blocker_id = ? AND blocked_user_id = ?
                """);
        this.insertBlock = session.prepare("""
                INSERT INTO user_blocks_by_blocker
                    (blocker_id, blocked_user_id, created_at, reason_text)
                VALUES (?, ?, ?, ?)
                IF NOT EXISTS
                """);
        this.insertBlockReverse = session.prepare("""
                INSERT INTO blocked_by_user
                    (blocked_user_id, blocker_id, created_at)
                VALUES (?, ?, ?)
                IF NOT EXISTS
                """);
        this.deleteBlock = session.prepare("""
                DELETE FROM user_blocks_by_blocker
                WHERE blocker_id = ? AND blocked_user_id = ?
                """);
        this.deleteBlockReverse = session.prepare("""
                DELETE FROM blocked_by_user
                WHERE blocked_user_id = ? AND blocker_id = ?
                """);
        this.findBlockReverse = session.prepare("""
                SELECT created_at
                FROM blocked_by_user
                WHERE blocked_user_id = ? AND blocker_id = ?
                """);
        this.listBlockedByActor = session.prepare("""
                SELECT blocked_user_id, created_at, reason_text
                FROM user_blocks_by_blocker
                WHERE blocker_id = ? LIMIT ?
                """);
        this.listBlockedByUser = session.prepare("""
                SELECT blocker_id, created_at
                FROM blocked_by_user
                WHERE blocked_user_id = ? LIMIT ?
                """);
    }

    public boolean claimRequest(UUID requesterId, UUID recipientId, UUID requestedAt, String message) {
        return session.execute(claimRequest.bind(requesterId, recipientId, requestedAt, message)).wasApplied();
    }

    public boolean resetRequestToPending(UUID requesterId, UUID recipientId, UUID requestedAt, String message) {
        return session.execute(resetRequestToPending.bind(requestedAt, message, requesterId, recipientId)).wasApplied();
    }

    public boolean markRequestStatus(UUID requesterId, UUID recipientId, String status, Instant resolvedAt) {
        return session.execute(updateRequestStatus.bind(status, resolvedAt, requesterId, recipientId)).wasApplied();
    }

    public void forceUpdateRequestStatus(UUID requesterId, UUID recipientId, String status, Instant resolvedAt) {
        session.execute(forceUpdateRequestStatus.bind(status, resolvedAt, requesterId, recipientId));
    }

    public RequestRow findRequest(UUID requesterId, UUID recipientId) {
        Row row = session.execute(loadRequest.bind(requesterId, recipientId)).one();
        return row == null ? null : new RequestRow(
                row.getUuid("requester_id"),
                row.getUuid("recipient_id"),
                row.getUuid("requested_at"),
                row.getString("message"),
                row.getString("status"),
                row.getInstant("resolved_at"));
    }

    public void saveRequestInbox(UUID recipientId, UUID requestedAt, UUID requesterId, String message) {
        session.execute(saveRequestInbox.bind(recipientId, requestedAt, requesterId, message));
    }

    public void deleteRequestInbox(UUID recipientId, UUID requestedAt, UUID requesterId) {
        session.execute(deleteRequestInbox.bind(recipientId, requestedAt, requesterId));
    }

    public List<IncomingRequestRow> listIncomingRequests(UUID recipientId, int limit) {
        return session.execute(listIncomingRequests.bind(recipientId, limit)).all().stream()
                .map(row -> new IncomingRequestRow(
                        row.getUuid("requested_at"),
                        row.getUuid("requester_id"),
                        row.getString("message")))
                .toList();
    }

    public FriendProjectionRow upsertFriendshipProjection(
            UUID userId,
            UUID otherUserId,
            String status,
            UUID updatedAt,
            Instant requestedAt,
            Instant acceptedAt) {
        ProjectionKeyRow oldKey = findProjectionKey(userId, otherUserId);
        if (oldKey != null && updatedAt.equals(oldKey.updatedAt())) {
            return new FriendProjectionRow(otherUserId, status, oldKey.updatedAt(), requestedAt, acceptedAt);
        }
        if (oldKey != null) {
            deleteFriendshipProjection(userId, oldKey.relationshipStatus(), oldKey.updatedAt(), otherUserId);
            deleteProjectionKey(userId, otherUserId);
        }
        session.execute(insertFriendshipProjection.bind(
                userId,
                status,
                updatedAt,
                otherUserId,
                requestedAt,
                acceptedAt));
        session.execute(saveProjectionKey.bind(userId, otherUserId, status, updatedAt));
        return new FriendProjectionRow(otherUserId, status, updatedAt, requestedAt, acceptedAt);
    }

    public void removeFriendshipProjection(UUID userId, UUID otherUserId) {
        ProjectionKeyRow oldKey = findProjectionKey(userId, otherUserId);
        if (oldKey == null) {
            return;
        }
        deleteFriendshipProjection(userId, oldKey.relationshipStatus(), oldKey.updatedAt(), otherUserId);
        deleteProjectionKey(userId, otherUserId);
    }

    public ProjectionKeyRow findProjectionKey(UUID userId, UUID otherUserId) {
        Row row = session.execute(findProjectionKey.bind(userId, otherUserId)).one();
        if (row == null) {
            return null;
        }
        return new ProjectionKeyRow(row.getString("relationship_status"), row.getUuid("updated_at"));
    }

    public List<FriendProjectionRow> listFriendshipByStatus(UUID userId, String relationshipStatus, int limit) {
        return session.execute(listFriendshipByStatus.bind(userId, relationshipStatus, limit)).all().stream()
                .map(row -> new FriendProjectionRow(
                        row.getUuid("other_user_id"),
                        row.getString("relationship_status"),
                        row.getUuid("updated_at"),
                        row.getInstant("requested_at"),
                        row.getInstant("accepted_at")))
                .toList();
    }

    public PairRow findFriendshipPair(UUID firstUserId, UUID secondUserId) {
        UserPair pair = UserPair.of(firstUserId, secondUserId);
        Row row = session.execute(loadFriendshipByPair.bind(pair.lowId(), pair.highId())).one();
        return row == null ? null : new PairRow(
                pair.lowId(),
                pair.highId(),
                row.getString("status"),
                row.getUuid("requested_by"),
                row.getInstant("requested_at"),
                row.getInstant("accepted_at"),
                row.getInstant("updated_at"));
    }

    public void upsertFriendshipPair(
            UUID firstUserId,
            UUID secondUserId,
            String status,
            UUID requestedBy,
            Instant requestedAt,
            Instant acceptedAt,
            Instant updatedAt) {
        UserPair pair = UserPair.of(firstUserId, secondUserId);
        session.execute(saveFriendshipByPair.bind(
                pair.lowId(),
                pair.highId(),
                status,
                requestedBy,
                requestedAt,
                acceptedAt,
                updatedAt));
    }

    public boolean markFriendshipRemoved(UUID firstUserId, UUID secondUserId, Instant updatedAt) {
        UserPair pair = UserPair.of(firstUserId, secondUserId);
        return session.execute(updateFriendshipRemoved.bind(updatedAt, pair.lowId(), pair.highId())).wasApplied();
    }

    public boolean isBlocked(UUID blockerId, UUID blockedUserId) {
        return session.execute(findBlockRow.bind(blockerId, blockedUserId)).one() != null;
    }

    public boolean isBlockedBy(UUID blockedUserId, UUID blockerId) {
        return session.execute(findBlockReverse.bind(blockedUserId, blockerId)).one() != null;
    }

    public boolean blockUser(UUID blockerId, UUID blockedUserId, String reasonText) {
        Instant now = Instant.now();
        var first = session.execute(insertBlock.bind(blockerId, blockedUserId, now, reasonText)).wasApplied();
        session.execute(insertBlockReverse.bind(blockedUserId, blockerId, now));
        return first;
    }

    public void unblockUser(UUID blockerId, UUID blockedUserId) {
        session.execute(deleteBlock.bind(blockerId, blockedUserId));
        session.execute(deleteBlockReverse.bind(blockedUserId, blockerId));
    }

    public List<BlockRow> listBlockedUsers(UUID blockerId, int limit) {
        return session.execute(listBlockedByActor.bind(blockerId, limit)).all().stream()
                .map(row -> new BlockRow(
                        blockerId,
                        row.getUuid("blocked_user_id"),
                        row.getInstant("created_at"),
                        row.getString("reason_text")))
                .toList();
    }

    public List<BlockRow> listBlockers(UUID blockedUserId, int limit) {
        return session.execute(listBlockedByUser.bind(blockedUserId, limit)).all().stream()
                .map(row -> new BlockRow(
                        row.getUuid("blocker_id"),
                        blockedUserId,
                        row.getInstant("created_at"),
                        null))
                .toList();
    }

    private void deleteFriendshipProjection(UUID userId, String status, UUID updatedAt, UUID otherUserId) {
        session.execute(deleteFriendshipProjection.bind(userId, status, updatedAt, otherUserId));
    }

    private void deleteProjectionKey(UUID userId, UUID otherUserId) {
        session.execute(deleteProjectionKey.bind(userId, otherUserId));
    }

    public record RequestRow(
            UUID requesterId,
            UUID recipientId,
            UUID requestedAt,
            String message,
            String status,
            Instant resolvedAt) {
    }

    public record IncomingRequestRow(UUID requestedAt, UUID requesterId, String message) {
    }

    public record FriendProjectionRow(
            UUID otherUserId,
            String relationshipStatus,
            UUID updatedAt,
            Instant requestedAt,
            Instant acceptedAt) {
    }

    public record ProjectionKeyRow(String relationshipStatus, UUID updatedAt) {
    }

    public record PairRow(
            UUID userLowId,
            UUID userHighId,
            String status,
            UUID requestedBy,
            Instant requestedAt,
            Instant acceptedAt,
            Instant updatedAt) {
    }

    public record BlockRow(UUID blockerId, UUID blockedUserId, Instant createdAt, String reasonText) {
    }

    public record UserPair(UUID lowId, UUID highId) {
        public static UserPair of(UUID first, UUID second) {
            return first.toString().compareTo(second.toString()) <= 0
                    ? new UserPair(first, second) : new UserPair(second, first);
        }
    }
}
