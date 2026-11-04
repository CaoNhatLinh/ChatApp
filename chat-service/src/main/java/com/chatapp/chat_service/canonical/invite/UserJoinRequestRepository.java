package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/** User-owned discovery index; status is read from the manager request authority. */
@Repository
public class UserJoinRequestRepository {
    private final CqlSession session;
    private final PreparedStatement firstPage;
    private final PreparedStatement older;
    private final PreparedStatement sameTime;
    private final PreparedStatement inviteRequest;
    private final PreparedStatement communityRequest;
    private final PreparedStatement communityClaim;

    public UserJoinRequestRepository(CqlSession session) {
        this.session = session;
        firstPage = session.prepare("SELECT * FROM join_requests_by_user WHERE user_id = ? LIMIT ?");
        older = session.prepare("""
                SELECT * FROM join_requests_by_user WHERE user_id = ? AND requested_at < ? LIMIT ?
                """);
        sameTime = session.prepare("""
                SELECT * FROM join_requests_by_user
                WHERE user_id = ? AND requested_at = ? AND request_id > ? LIMIT ?
                """);
        inviteRequest = session.prepare("""
                SELECT user_id, status, resolved_at FROM join_requests_by_conversation
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                """);
        communityRequest = session.prepare("""
                SELECT user_id, status, resolved_at FROM community_join_requests_by_conversation
                WHERE conversation_id = ? AND requested_at = ? AND request_id = ?
                """);
        communityClaim = session.prepare("""
                SELECT user_id, requested_at, request_id, status, resolved_at
                FROM community_join_request_by_user WHERE conversation_id = ? AND user_id = ?
                """);
    }

    public Page list(UUID userId, String cursor, int limit) {
        if (limit < 1 || limit > 50) throw new BadRequestException("limit must be between 1 and 50");
        Cursor before = decodeCursor(cursor);
        int fetch = limit + 1;
        List<Row> rows = new ArrayList<>();
        if (before == null) {
            rows.addAll(session.execute(firstPage.bind(userId, fetch)).all());
        } else {
            // Mixed clustering directions: time DESC, request ID ASC. Continue ties first.
            rows.addAll(session.execute(sameTime.bind(userId, before.requestedAt(), before.requestId(), fetch)).all());
            if (rows.size() < fetch) {
                rows.addAll(session.execute(older.bind(userId, before.requestedAt(), fetch - rows.size())).all());
            }
        }
        boolean hasNext = rows.size() > limit;
        List<Row> visible = rows.subList(0, Math.min(limit, rows.size()));
        List<View> content = visible.stream().map(row -> currentView(userId, row)).toList();
        Row last = visible.isEmpty() ? null : visible.get(visible.size() - 1);
        String nextCursor = hasNext && last != null
                ? encodeCursor(new Cursor(last.getUuid("requested_at"), last.getUuid("request_id"))) : null;
        return new Page(content, nextCursor, hasNext);
    }

    private View currentView(UUID userId, Row index) {
        UUID conversationId = index.getUuid("conversation_id");
        UUID requestedAt = index.getUuid("requested_at");
        UUID requestId = index.getUuid("request_id");
        UUID linkId = index.getUuid("link_id");
        Row authority = linkId == null ? currentCommunityRequest(userId, conversationId, requestedAt, requestId)
                : session.execute(inviteRequest.bind(conversationId, requestedAt, requestId)).one();
        // Do not report stale PENDING/APPROVED snapshots when authority is absent or mismatched.
        boolean available = authority != null && userId.equals(authority.getUuid("user_id"));
        return new View(conversationId, requestedAt, Instant.ofEpochMilli(Uuids.unixTimestamp(requestedAt)), requestId, linkId,
                available ? authority.getString("status") : "RETRY_REQUIRED",
                available ? authority.getInstant("resolved_at") : null);
    }

    private Row currentCommunityRequest(UUID userId, UUID conversationId, UUID requestedAt, UUID requestId) {
        Row claim = session.execute(communityClaim.bind(conversationId, userId)).one();
        if (claim == null || !userId.equals(claim.getUuid("user_id"))) return null;
        if (requestId.equals(claim.getUuid("request_id")) && requestedAt.equals(claim.getUuid("requested_at"))) {
            return claim;
        }
        // A new attempt replaces the per-user claim; only a terminal historical projection is safe.
        Row history = session.execute(communityRequest.bind(conversationId, requestedAt, requestId)).one();
        return history != null && java.util.Set.of("APPROVED", "DECLINED", "FAILED", "CANCELLED")
                .contains(history.getString("status")) ? history : null;
    }

    static Cursor decodeCursor(String cursor) {
        if (cursor == null) return null;
        if (cursor.length() > 128) throw new BadRequestException("invalid join request cursor");
        try {
            String[] parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split(":", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            UUID requestedAt = UUID.fromString(parts[0]);
            UUID requestId = UUID.fromString(parts[1]);
            if (requestedAt.version() != 1) throw new IllegalArgumentException();
            return new Cursor(requestedAt, requestId);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("invalid join request cursor");
        }
    }

    static String encodeCursor(Cursor cursor) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(
                (cursor.requestedAt() + ":" + cursor.requestId()).getBytes(StandardCharsets.UTF_8));
    }

    record Cursor(UUID requestedAt, UUID requestId) { }
    public record View(UUID conversationId, UUID requestedAt, Instant requestedOn, UUID requestId, UUID linkId,
                       String status, Instant resolvedAt) { }
    public record Page(List<View> content, String nextCursor, boolean hasNext) { }
}
