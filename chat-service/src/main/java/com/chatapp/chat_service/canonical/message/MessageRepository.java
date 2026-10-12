package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface MessageRepository {
    MessageClaim claim(
            UUID senderId, UUID clientMessageId, UUID conversationId,
            String bucket, String requestFingerprint, Instant now);

    void save(CanonicalMessage message);

    void saveBucket(CanonicalMessage message);

    void saveAttachment(CanonicalMessage message, CanonicalApiContracts.AttachmentRequest attachment);

    void saveMentions(CanonicalMessage message, Set<UUID> mentionedUserIds);

    CanonicalMessage find(UUID conversationId, String bucket, UUID messageId);

    List<CanonicalMessage> findByBucket(UUID conversationId, String bucket, int limit);

    List<CanonicalMessage> findByBucketBefore(UUID conversationId, String bucket, UUID beforeMessageId, int limit);

    List<MessageBucket> findBuckets(UUID conversationId, Instant beforeOrAtHour, int limit);

    boolean markRead(UUID conversationId, String bucket, UUID messageId, UUID readerId, Instant readAt);

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

    boolean setPinned(UUID conversationId, String bucket, UUID messageId, UUID actorId, boolean pinned);

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
