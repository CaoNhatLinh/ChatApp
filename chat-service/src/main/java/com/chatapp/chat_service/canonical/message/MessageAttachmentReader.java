package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.media.MediaThumbnail;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAttachment;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Message membership grants reads of its references, not arbitrary asset IDs. */
@Service
public class MessageAttachmentReader {
    private final MessageRepository messages;
    private final MediaAssetRepository assets;
    private final ConversationAuthorizationService authorization;
    private final FriendshipRepository friendships;

    public MessageAttachmentReader(MessageRepository messages, MediaAssetRepository assets,
                                   ConversationAuthorizationService authorization, FriendshipRepository friendships) {
        this.messages = messages;
        this.assets = assets;
        this.authorization = authorization;
        this.friendships = friendships;
    }

    public enum Status { READY, UNAVAILABLE }
    public record Item(UUID attachmentId, UUID assetId, String fileName, String mimeType, Long byteSize,
                       Integer width, Integer height, Long durationMs, boolean spoiler,
                       Status status, String url, String thumbnailUrl) { }
    public record Page(UUID conversationId, String messageBucket, UUID messageId,
                       List<Item> content, UUID nextCursor, boolean hasNext) { }

    public Page list(UUID actor, UUID room, String bucket, UUID messageId, int limit, UUID cursor) {
        if (limit < 1 || limit > 50) throw new BadRequestException("attachment limit must be between 1 and 50");
        authorization.requireMember(room, actor);
        var message = messages.find(room, bucket, messageId);
        if (message == null || Boolean.TRUE.equals(message.isDeleted()) || friendships.isBlocked(actor, message.senderId()))
            throw new NotFoundException("message attachments unavailable");
        if (!Boolean.TRUE.equals(message.hasAttachments())) return new Page(room, bucket, messageId, List.of(), null, false);
        var rows = messages.findAttachments(room, bucket, messageId, cursor, limit + 1);
        boolean hasNext = rows.size() > limit;
        var content = rows.stream().limit(limit).map(this::resolve).toList();
        UUID next = hasNext ? content.get(content.size() - 1).attachmentId() : null;
        return new Page(room, bucket, messageId, content, next, hasNext);
    }

    private Item resolve(CanonicalAttachment ref) {
        var asset = ref.assetId() == null ? null : assets.findById(ref.assetId());
        if (asset == null || asset.deletedAt() != null || !"READY".equals(asset.uploadStatus())
                || !Objects.equals(asset.storageProvider(), ref.storageProvider())
                || !Objects.equals(asset.storageKey(), ref.storageKey()) || !safeUrl(asset.publicUrl())) {
            return new Item(ref.attachmentId(), ref.assetId(), ref.fileName(), ref.mimeType(), ref.byteSize(),
                    ref.width(), ref.height(), ref.durationMs(), Boolean.TRUE.equals(ref.isSpoiler()), Status.UNAVAILABLE, null, null);
        }
        String thumbnail = assets.findThumbnails(asset.assetId()).stream()
                .filter(value -> value.variant() == MediaThumbnail.Variant.SMALL && value.status() == MediaThumbnail.Status.READY)
                .map(MediaThumbnail::url).findFirst().orElse(null);
        return new Item(ref.attachmentId(), asset.assetId(), asset.fileName(), asset.mimeType(), asset.byteSize(),
                asset.width(), asset.height(), asset.durationMs(), Boolean.TRUE.equals(ref.isSpoiler()), Status.READY,
                asset.publicUrl(), thumbnail);
    }

    private static boolean safeUrl(String value) {
        try {
            var uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getFragment() == null;
        } catch (IllegalArgumentException | NullPointerException exception) { return false; }
    }
}
