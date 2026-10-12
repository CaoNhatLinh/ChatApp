package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchStatementBuilder;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.data.UdtValue;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Repository
public class CassandraMessageRepository implements MessageRepository {
    private final CqlSession session;
    private final UserDefinedType attachmentRefType;
    private final PreparedStatement claimByClientId;
    private final PreparedStatement loadByClientId;
    private final PreparedStatement save;
    private final PreparedStatement load;
    private final PreparedStatement listByBucket;
    private final PreparedStatement listByBucketBefore;
    private final PreparedStatement saveBucket;
    private final PreparedStatement listBuckets;
    private final PreparedStatement listBucketsBefore;
    private final PreparedStatement saveAttachment;
    private final PreparedStatement saveMentionByMessage;
    private final PreparedStatement saveMentionInbox;
    private final PreparedStatement saveReaction;
    private final PreparedStatement deleteReaction;
    private final PreparedStatement saveReactionProjection;
    private final PreparedStatement deleteReactionProjection;
    private final PreparedStatement listReactionProjection;
    private final PreparedStatement setPinned;
    private final CassandraReadPointer readPointer;
    private final PreparedStatement saveReadReceipt;
    private final PreparedStatement listReadReceipts;
    private final PreparedStatement listReadReceiptsAfter;
    private final PreparedStatement updateReadSummary;
    private final PreparedStatement listReadSummaries;
    private final PreparedStatement saveRevision;
    private final PreparedStatement listRevisions;
    private final PreparedStatement loadEditState;
    private final PreparedStatement updateContent;
    private final PreparedStatement markDeleted;
    private final PreparedStatement claimPinSlot;
    private final PreparedStatement listPinSlots;
    private final PreparedStatement deletePinSlot;

    public CassandraMessageRepository(CqlSession session) {
        this.session = session;
        this.attachmentRefType = session.getMetadata().getKeyspace("chat_app")
                .flatMap(keyspace -> keyspace.getUserDefinedType("attachment_ref"))
                .orElseThrow(() -> new IllegalStateException("Missing UDT attachment_ref"));
        this.claimByClientId = session.prepare("""
                INSERT INTO message_id_by_client_id
                    (sender_id, client_message_id, conversation_id, message_bucket, message_id, request_fingerprint, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.loadByClientId = session.prepare("""
                SELECT message_id, conversation_id, message_bucket, request_fingerprint, created_at
                FROM message_id_by_client_id WHERE sender_id = ? AND client_message_id = ?
                """);
        this.save = session.prepare("""
                INSERT INTO messages_by_conversation_bucket (
                    conversation_id, message_bucket, message_id, sender_id, message_type, content,
                    content_format, reply_to_message_id, reply_to_sender_id, sticker_id, poll_id,
                    system_event_id, forwarded_from_conversation_id, forwarded_from_message_bucket,
                    forwarded_from_message_id, is_deleted, deleted_by, deleted_at, edited_at,
                    revision_no, has_attachments, has_mentions, is_pinned, created_at, client_message_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
                """);
        this.load = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.listByBucket = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? LIMIT ?
                """);
        this.listByBucketBefore = session.prepare("""
                SELECT * FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id < ? LIMIT ?
                """);
        this.saveBucket = session.prepare("""
                INSERT INTO message_buckets_by_conversation
                    (conversation_id, bucket_hour, message_bucket, last_message_id, last_message_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listBuckets = session.prepare("""
                SELECT bucket_hour, message_bucket FROM message_buckets_by_conversation
                WHERE conversation_id = ? LIMIT ?
                """);
        this.listBucketsBefore = session.prepare("""
                SELECT bucket_hour, message_bucket FROM message_buckets_by_conversation
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
        this.saveReactionProjection = session.prepare("""
                INSERT INTO message_reactions_by_conversation_bucket
                    (conversation_id, message_bucket, message_id, emoji, user_id, reacted_at)
                VALUES (?, ?, ?, ?, ?, now())
                """);
        this.deleteReactionProjection = session.prepare("""
                DELETE FROM message_reactions_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? AND emoji = ? AND user_id = ?
                """);
        this.listReactionProjection = session.prepare("""
                SELECT message_id, emoji, user_id FROM message_reactions_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id IN ?
                """);
        this.setPinned = session.prepare("""
                UPDATE messages_by_conversation_bucket SET is_pinned = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.readPointer = new CassandraReadPointer(session);
        this.saveReadReceipt = session.prepare("""
                INSERT INTO message_read_receipts_by_message
                    (conversation_id, message_bucket, message_id, reader_id, read_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.listReadReceipts = session.prepare("""
                SELECT reader_id, read_at FROM message_read_receipts_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? LIMIT ?
                """);
        this.listReadReceiptsAfter = session.prepare("""
                SELECT reader_id, read_at FROM message_read_receipts_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? AND reader_id > ? LIMIT ?
                """);
        this.updateReadSummary = session.prepare("""
                UPDATE message_read_summary_by_conversation_bucket SET latest_read_at = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.listReadSummaries = session.prepare("""
                SELECT message_id, latest_read_at FROM message_read_summary_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id IN ?
                """);
        this.saveRevision = session.prepare("""
                INSERT INTO message_revisions_by_message
                    (conversation_id, message_bucket, message_id, revision_no, content, action, edited_by, edited_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.listRevisions = session.prepare("""
                SELECT revision_no, content, action, edited_by, edited_at FROM message_revisions_by_message
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.loadEditState = session.prepare("""
                SELECT content, sender_id, is_deleted, revision_no FROM messages_by_conversation_bucket
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ?
                """);
        this.updateContent = session.prepare("""
                UPDATE messages_by_conversation_bucket SET content = ?, edited_at = ?, revision_no = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? IF revision_no = ?
                """);
        this.markDeleted = session.prepare("""
                UPDATE messages_by_conversation_bucket
                SET is_deleted = true, deleted_by = ?, deleted_at = ?, revision_no = ?
                WHERE conversation_id = ? AND message_bucket = ? AND message_id = ? IF revision_no = ?
                """);
        this.claimPinSlot = session.prepare("""
                INSERT INTO pinned_message_slots_by_conversation
                    (conversation_id, pin_slot, message_bucket, message_id, pinned_by, pinned_at)
                VALUES (?, ?, ?, ?, ?, now()) IF NOT EXISTS
                """);
        this.listPinSlots = session.prepare("""
                SELECT pin_slot, message_bucket, message_id, pinned_by
                FROM pinned_message_slots_by_conversation WHERE conversation_id = ?
                """);
        this.deletePinSlot = session.prepare("""
                DELETE FROM pinned_message_slots_by_conversation
                WHERE conversation_id = ? AND pin_slot = ?
                """);
    }

    @Override
    public MessageClaim claim(
            UUID senderId, UUID clientMessageId, UUID conversationId,
            String bucket, String requestFingerprint, Instant now) {
        Row existing = session.execute(loadByClientId.bind(senderId, clientMessageId)).one();
        if (existing != null) return claim(existing, conversationId, requestFingerprint, false);
        UUID messageId = Uuids.timeBased();
        var result = session.execute(claimByClientId.bind(
                senderId, clientMessageId, conversationId, bucket, messageId, requestFingerprint, now));
        if (result.wasApplied()) return new MessageClaim(messageId, bucket, now, true, true);
        Row retry = session.execute(loadByClientId.bind(senderId, clientMessageId)).one();
        return retry == null ? null : claim(retry, conversationId, requestFingerprint, false);
    }

    @Override
    public void save(CanonicalMessage message) {
        session.execute(save.bind(
                message.conversationId(), message.messageBucket(), message.messageId(), message.senderId(),
                message.messageType(), message.content(), message.contentFormat(), message.replyToMessageId(),
                message.replyToSenderId(), message.stickerId(), message.pollId(), message.systemEventId(),
                message.forwardedFromConversationId(), message.forwardedFromMessageBucket(),
                message.forwardedFromMessageId(), message.isDeleted(), message.deletedBy(), message.deletedAt(),
                message.editedAt(), message.hasAttachments(), message.hasMentions(), message.isPinned(),
                message.createdAt(), message.clientMessageId()));
        saveBucket(message);
    }

    @Override
    public void saveBucket(CanonicalMessage message) {
        session.execute(saveBucket.bind(
                message.conversationId(), message.createdAt().truncatedTo(ChronoUnit.HOURS),
                message.messageBucket(), message.messageId(), message.createdAt()));
    }

    @Override
    public void saveAttachment(CanonicalMessage message, CanonicalApiContracts.AttachmentRequest attachment) {
        UdtValue value = attachmentRefType.newValue()
                .setUuid("attachment_id", attachment.attachmentId())
                .setUuid("asset_id", attachment.assetId())
                .setString("storage_provider", attachment.storageProvider())
                .setString("storage_key", attachment.storageKey())
                .setString("file_name", attachment.fileName())
                .setString("mime_type", attachment.mimeType())
                .setString("thumbnail_url", attachment.thumbnailUrl())
                .setBoolean("is_spoiler", Boolean.TRUE.equals(attachment.isSpoiler()));
        nullableLong(value, "byte_size", attachment.byteSize());
        nullableInt(value, "width", attachment.width());
        nullableInt(value, "height", attachment.height());
        nullableLong(value, "duration_ms", attachment.durationMs());
        session.execute(saveAttachment.bind(
                message.conversationId(), message.messageBucket(), message.messageId(),
                attachment.attachmentId(), value));
    }

    @Override
    public void saveMentions(CanonicalMessage message, Set<UUID> userIds) {
        BatchStatementBuilder batch = BatchStatement.builder(BatchType.UNLOGGED);
        for (UUID userId : userIds) {
            batch.addStatement(saveMentionByMessage.bind(
                    message.conversationId(), message.messageBucket(), message.messageId(), userId));
            batch.addStatement(saveMentionInbox.bind(
                    userId, message.conversationId(), message.messageBucket(), message.messageId(), message.senderId()));
        }
        session.execute(batch.build());
    }

    @Override
    public CanonicalMessage find(UUID conversationId, String bucket, UUID messageId) {
        Row row = session.execute(load.bind(conversationId, bucket, messageId)).one();
        return row == null ? null : map(row);
    }

    @Override
    public List<CanonicalMessage> findByBucket(UUID conversationId, String bucket, int limit) {
        return session.execute(listByBucket.bind(conversationId, bucket, limit)).all().stream()
                .map(this::map).toList();
    }

    @Override
    public List<CanonicalMessage> findByBucketBefore(
            UUID conversationId, String bucket, UUID beforeMessageId, int limit) {
        return session.execute(listByBucketBefore.bind(conversationId, bucket, beforeMessageId, limit))
                .all().stream().map(this::map).toList();
    }

    @Override
    public List<MessageBucket> findBuckets(UUID conversationId, Instant beforeOrAtHour, int limit) {
        var result = beforeOrAtHour == null
                ? session.execute(listBuckets.bind(conversationId, limit))
                : session.execute(listBucketsBefore.bind(conversationId, beforeOrAtHour, limit));
        return result.all().stream().map(row -> new MessageBucket(
                row.getInstant("bucket_hour"), row.getString("message_bucket"))).toList();
    }

    @Override
    public boolean markRead(UUID conversationId, String bucket, UUID messageId, UUID readerId, Instant readAt) {
        if (!readPointer.advance(conversationId, readerId, messageId, readAt)) return false;
        session.execute(BatchStatement.builder(BatchType.LOGGED)
                .addStatement(saveReadReceipt.bind(conversationId, bucket, messageId, readerId, readAt))
                .addStatement(updateReadSummary.bind(readAt, conversationId, bucket, messageId)).build());
        return true;
    }

    @Override
    public List<ReadReceipt> findReadReceipts(
            UUID conversationId, String bucket, UUID messageId, UUID afterReaderId, int limit) {
        var result = afterReaderId == null
                ? session.execute(listReadReceipts.bind(conversationId, bucket, messageId, limit))
                : session.execute(listReadReceiptsAfter.bind(
                        conversationId, bucket, messageId, afterReaderId, limit));
        return result.all().stream().map(row -> new ReadReceipt(
                row.getUuid("reader_id"), row.getInstant("read_at"))).toList();
    }

    @Override
    public List<CanonicalApiContracts.MessageRevisionView> findRevisions(
            UUID conversationId, String bucket, UUID messageId) {
        return session.execute(listRevisions.bind(conversationId, bucket, messageId)).all().stream()
                .map(row -> new CanonicalApiContracts.MessageRevisionView(
                        row.getInt("revision_no"), row.getString("content"), row.getString("action"),
                        row.getUuid("edited_by"), row.getInstant("edited_at"))).toList();
    }

    @Override
    public boolean updateContent(
            UUID conversationId, String bucket, UUID messageId, String content, UUID editedBy) {
        for (int attempt = 0; attempt < 3; attempt++) {
            Row state = session.execute(loadEditState.bind(conversationId, bucket, messageId)).one();
            if (state == null || state.getBoolean("is_deleted")) return false;
            int prior = state.isNull("revision_no") ? 0 : state.getInt("revision_no");
            int next = prior + 1;
            Instant editedAt = Instant.now();
            if (session.execute(updateContent.bind(
                    content, editedAt, next, conversationId, bucket, messageId, prior)).wasApplied()) {
                session.execute(saveRevision.bind(
                        conversationId, bucket, messageId, next, state.getString("content"),
                        "EDIT", editedBy, editedAt));
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean delete(UUID conversationId, String bucket, UUID messageId, UUID deletedBy) {
        for (int attempt = 0; attempt < 3; attempt++) {
            Row state = session.execute(loadEditState.bind(conversationId, bucket, messageId)).one();
            if (state == null || state.getBoolean("is_deleted")) return false;
            int prior = state.isNull("revision_no") ? 0 : state.getInt("revision_no");
            int next = prior + 1;
            Instant deletedAt = Instant.now();
            if (session.execute(markDeleted.bind(
                    deletedBy, deletedAt, next, conversationId, bucket, messageId, prior)).wasApplied()) {
                session.execute(saveRevision.bind(
                        conversationId, bucket, messageId, next, state.getString("content"),
                        "DELETE", deletedBy, deletedAt));
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean addReaction(UUID conversationId, String bucket, UUID messageId, UUID userId, String emoji) {
        boolean applied = session.execute(
                saveReaction.bind(conversationId, bucket, messageId, emoji, userId)).wasApplied();
        session.execute(saveReactionProjection.bind(conversationId, bucket, messageId, emoji, userId));
        return applied;
    }

    @Override
    public boolean removeReaction(UUID conversationId, String bucket, UUID messageId, UUID userId, String emoji) {
        boolean applied = session.execute(
                deleteReaction.bind(conversationId, bucket, messageId, emoji, userId)).wasApplied();
        session.execute(deleteReactionProjection.bind(conversationId, bucket, messageId, emoji, userId));
        return applied;
    }

    @Override
    public List<CanonicalApiContracts.MessageInteractionView> findInteractions(
            UUID conversationId, String bucket, List<UUID> messageIds, UUID actorId) {
        if (messageIds.isEmpty()) return List.of();
        Map<UUID, Map<String, Long>> counts = new LinkedHashMap<>();
        Map<UUID, Set<String>> actorReactions = new LinkedHashMap<>();
        for (Row row : session.execute(listReactionProjection.bind(conversationId, bucket, messageIds))) {
            UUID messageId = row.getUuid("message_id");
            String emoji = row.getString("emoji");
            counts.computeIfAbsent(messageId, ignored -> new LinkedHashMap<>()).merge(emoji, 1L, Long::sum);
            if (actorId.equals(row.getUuid("user_id"))) {
                actorReactions.computeIfAbsent(messageId, ignored -> new java.util.LinkedHashSet<>()).add(emoji);
            }
        }
        Map<UUID, Instant> reads = new LinkedHashMap<>();
        for (Row row : session.execute(listReadSummaries.bind(conversationId, bucket, messageIds))) {
            reads.put(row.getUuid("message_id"), row.getInstant("latest_read_at"));
        }
        return messageIds.stream().map(messageId -> {
            Set<String> mine = actorReactions.getOrDefault(messageId, Set.of());
            List<CanonicalApiContracts.MessageReactionView> reactions = counts.getOrDefault(messageId, Map.of())
                    .entrySet().stream().map(entry -> new CanonicalApiContracts.MessageReactionView(
                            entry.getKey(), entry.getValue(), mine.contains(entry.getKey()))).toList();
            return new CanonicalApiContracts.MessageInteractionView(messageId, reactions, reads.get(messageId));
        }).toList();
    }

    @Override
    public boolean setPinned(UUID conversationId, String bucket, UUID messageId, UUID actorId, boolean pinned) {
        if (!pinned) {
            for (Row row : session.execute(listPinSlots.bind(conversationId))) {
                if (messageId.equals(row.getUuid("message_id")) && bucket.equals(row.getString("message_bucket"))) {
                    session.execute(deletePinSlot.bind(conversationId, row.getByte("pin_slot")));
                }
            }
            session.execute(setPinned.bind(false, conversationId, bucket, messageId));
            return true;
        }
        if (alreadyPinned(conversationId, bucket, messageId)) {
            session.execute(setPinned.bind(true, conversationId, bucket, messageId));
            return true;
        }
        for (int slot = 0; slot < 5; slot++) {
            if (session.execute(claimPinSlot.bind(
                    conversationId, (byte) slot, bucket, messageId, actorId)).wasApplied()) {
                session.execute(setPinned.bind(true, conversationId, bucket, messageId));
                return true;
            }
        }
        return false;
    }

    private boolean alreadyPinned(UUID conversationId, String bucket, UUID messageId) {
        for (Row row : session.execute(listPinSlots.bind(conversationId))) {
            if (messageId.equals(row.getUuid("message_id")) && bucket.equals(row.getString("message_bucket"))) {
                return true;
            }
        }
        return false;
    }

    private MessageClaim claim(Row row, UUID conversationId, String fingerprint, boolean claimed) {
        boolean matches = conversationId.equals(row.getUuid("conversation_id"))
                && fingerprint.equals(row.getString("request_fingerprint"));
        return new MessageClaim(
                row.getUuid("message_id"), row.getString("message_bucket"),
                row.getInstant("created_at"), claimed, matches);
    }

    private CanonicalMessage map(Row row) {
        return new CanonicalMessage(
                row.getUuid("conversation_id"), row.getString("message_bucket"), row.getUuid("message_id"),
                row.getUuid("sender_id"), row.getString("message_type"), row.getString("content"),
                row.getString("content_format"), row.getUuid("reply_to_message_id"),
                row.getUuid("reply_to_sender_id"), row.getUuid("sticker_id"), row.getUuid("poll_id"),
                row.getUuid("system_event_id"), row.getUuid("forwarded_from_conversation_id"),
                row.getString("forwarded_from_message_bucket"), row.getUuid("forwarded_from_message_id"),
                row.getBoolean("is_deleted"), row.getUuid("deleted_by"), row.getInstant("deleted_at"),
                row.getInstant("edited_at"), row.getBoolean("has_attachments"),
                row.getBoolean("has_mentions"), row.getBoolean("is_pinned"), row.getInstant("created_at"),
                row.getUuid("client_message_id"));
    }

    private void nullableInt(UdtValue value, String field, Integer input) {
        if (input == null) value.setToNull(field); else value.setInt(field, input);
    }

    private void nullableLong(UdtValue value, String field, Long input) {
        if (input == null) value.setToNull(field); else value.setLong(field, input);
    }
}
