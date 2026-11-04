package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAttachment;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.*;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Verifies an immediate-source snapshot; never follows private forwarding chains. */
@Component
public class MessageForwardPolicy {
    private final MessageRepository messages;
    private final ConversationAuthorizationService authorization;
    private final FriendshipRepository friendships;

    public MessageForwardPolicy(MessageRepository messages, ConversationAuthorizationService authorization,
                                FriendshipRepository friendships) {
        this.messages = messages; this.authorization = authorization; this.friendships = friendships;
    }

    public static void validateShape(MessageSendRequest request) {
        if (request.forwardedFromConversationId() == null && request.forwardedFromMessageBucket() == null
                && request.forwardedFromMessageId() == null) return;
        if (request.forwardedFromConversationId() == null) throw new BadRequestException("forward source conversation is required");
        MessageReplyPolicy.validateSourceKey(request.forwardedFromMessageId(), request.forwardedFromMessageBucket());
        if (request.replyToMessageId() != null || request.mentionEveryone()
                || (request.mentionedUserIds() != null && !request.mentionedUserIds().isEmpty())) {
            throw new BadRequestException("forward must not create reply or mention semantics");
        }
        if ("POLL".equalsIgnoreCase(request.messageType()) || "SYSTEM".equalsIgnoreCase(request.messageType())) {
            throw new BadRequestException("poll and system forwarding is unavailable");
        }
        if (request.attachments() != null && request.attachments().size() > 50) {
            throw new BadRequestException("forward supports at most 50 attachments");
        }
    }

    public CanonicalMessage resolve(UUID actor, MessageSendRequest request) {
        if (request.forwardedFromMessageId() == null) return null;
        var source = readSource(actor, request.forwardedFromConversationId(), request.forwardedFromMessageBucket(), request.forwardedFromMessageId());
        if (!Objects.equals(source.content(), request.content()) || !Objects.equals(source.messageType(), request.messageType())
                || !Objects.equals(source.contentFormat(), request.contentFormat())
                || !Objects.equals(source.stickerId(), request.stickerId()) || !Objects.equals(source.gif(), request.gif())
                || request.pollId() != null) {
            throw new ConflictException("forward source changed or snapshot does not match; reload the source");
        }
        verifyAttachments(source, request.attachments());
        return source;
    }

    public record Draft(CanonicalMessage message, List<CanonicalAttachment> attachments) { }

    public Draft prepare(UUID actor, UUID room, String bucket, UUID id) {
        MessageReplyPolicy.validateSourceKey(id, bucket);
        var source = readSource(actor, room, bucket, id);
        if ("POLL".equals(source.messageType()) || "SYSTEM".equals(source.messageType())) {
            throw new BadRequestException("poll and system forwarding is unavailable");
        }
        return new Draft(source, List.copyOf(sourceAttachments(source)));
    }

    private CanonicalMessage readSource(UUID actor, UUID room, String bucket, UUID id) {
        try { authorization.requireMember(room, actor); }
        catch (ForbiddenException | NotFoundException unavailable) { throw unavailable(); }
        var source = messages.find(room, bucket, id);
        if (source == null || Boolean.TRUE.equals(source.isDeleted()) || friendships.isBlocked(actor, source.senderId())) throw unavailable();
        return source;
    }

    private List<CanonicalAttachment> sourceAttachments(CanonicalMessage source) {
        if (!Boolean.TRUE.equals(source.hasAttachments())) return List.of();
        var attachments = messages.findAttachments(source.conversationId(), source.messageBucket(), source.messageId(), null, 51);
        if (attachments.isEmpty() || attachments.size() > 50) throw snapshotConflict();
        return attachments;
    }

    private void verifyAttachments(CanonicalMessage source, List<AttachmentRequest> requested) {
        var actual = new ArrayList<>(sourceAttachments(source));
        var supplied = requested == null ? List.<AttachmentRequest>of() : requested;
        if (actual.size() != supplied.size()) throw snapshotConflict();
        for (var attachment : supplied) {
            if (attachment == null) throw snapshotConflict();
            var matching = actual.stream().filter(row -> row.equals(new CanonicalAttachment(row.attachmentId(),
                    attachment.assetId(), attachment.storageProvider(), attachment.storageKey(), attachment.fileName(),
                    attachment.mimeType(), attachment.byteSize(), attachment.width(), attachment.height(),
                    attachment.durationMs(), attachment.thumbnailUrl(), attachment.isSpoiler()))).findFirst();
            if (matching.isEmpty()) throw snapshotConflict();
            actual.remove(matching.get());
        }
    }

    private static ConflictException snapshotConflict() { return new ConflictException("forward attachments do not match the source"); }
    private static NotFoundException unavailable() { return new NotFoundException("forward source is unavailable"); }
}
