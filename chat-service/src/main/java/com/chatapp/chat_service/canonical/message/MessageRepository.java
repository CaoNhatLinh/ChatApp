package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAttachment;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface MessageRepository {
    MessageClaim findClaim(UUID senderId, UUID clientMessageId, UUID conversationId, String requestFingerprint);

    MessageClaim claim(
            UUID senderId, UUID clientMessageId, UUID conversationId,
            String bucket, String requestFingerprint, Instant now);

    /** Creates only the authority row. False never overwrites existing edits/deletion. */
    boolean createIfAbsent(CanonicalMessage message);

    void saveBucket(CanonicalMessage message);

    void repairSourceProjections(CanonicalMessage message);

    List<ReplyReference> findReplies(UUID conversationId, String parentBucket, UUID parentId, ReplyPosition after, int limit);

    record ReplyPosition(UUID createdAt, UUID messageId) { }

    record ReplyReference(UUID createdAt, UUID messageId, String messageBucket) { }

    void saveAttachment(CanonicalMessage message, CanonicalApiContracts.AttachmentRequest attachment);

    List<CanonicalAttachment> findAttachments(
            UUID conversationId, String bucket, UUID messageId, UUID afterAttachmentId, int limit);

    void saveMentions(CanonicalMessage message, Set<UUID> mentionedUserIds);

    void repairMentionReferences(CanonicalMessage message, Set<UUID> mentionedUserIds);

    CanonicalMessage find(UUID conversationId, String bucket, UUID messageId);

    List<CanonicalMessage> findByBucket(UUID conversationId, String bucket, int limit);

    List<CanonicalMessage> findByBucketBefore(UUID conversationId, String bucket, UUID beforeMessageId, int limit);

    List<MessageBucket> findBuckets(UUID conversationId, Instant beforeOrAtHour, int limit);

    boolean markRead(UUID conversationId, String bucket, UUID messageId, UUID readerId, Instant joinedAt, Instant readAt);

    boolean advanceReadPosition(UUID conversationId, UUID readerId, UUID messageId, Instant joinedAt, Instant readAt);

    List<ReadReceipt> findReadReceipts(
            UUID conversationId, String bucket, UUID messageId, UUID afterReaderId, int limit);

    List<CanonicalApiContracts.MessageRevisionView> findRevisions(
            UUID conversationId, String bucket, UUID messageId);

    boolean updateContent(UUID conversationId, String bucket, UUID messageId, String content, UUID editedBy);

    boolean delete(UUID conversationId, String bucket, UUID messageId, UUID deletedBy);

    boolean addReaction(UUID conversationId, String bucket, UUID messageId, UUID userId, String emoji);

    boolean removeReaction(UUID conversationId, String bucket, UUID messageId, UUID userId, String emoji);

    List<CanonicalApiContracts.MessageInteractionView> findInteractions(
            UUID conversationId, String bucket, List<UUID> messageIds, UUID actorId);

    PinState findPinState(UUID conversationId);

    PinChange changePin(UUID conversationId, String bucket, UUID messageId, UUID actorId, boolean pinned, long expectedRevision);

    record PinSlot(byte number, String bucket, UUID message, UUID generation) { }
    record PinState(long revision, List<PinSlot> slots) {
        public PinState { slots = List.copyOf(slots); }
        public boolean contains(String bucket, UUID message) {
            return slots.stream().anyMatch(slot -> slot.bucket().equals(bucket) && slot.message().equals(message));
        }
    }
    record PinChange(PinState state, boolean changed) { }

    record MessageClaim(
            UUID messageId,
            String messageBucket,
            Instant createdAt,
            boolean claimed,
            boolean matchesRequest) {
    }

    record MessageBucket(Instant bucketHour, String value) {
    }

    record ReadReceipt(UUID readerId, Instant readAt) {
    }
}
