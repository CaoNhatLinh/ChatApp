package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import java.util.UUID;

/** Reads provenance through destination authority, never through a client-supplied source key. */
@Service
public class MessageForwardSourceService {
    private final MessageRepository messages;
    private final ConversationAuthorizationService authorization;
    private final FriendshipRepository friendships;

    public MessageForwardSourceService(MessageRepository messages, ConversationAuthorizationService authorization,
                                       FriendshipRepository friendships) {
        this.messages = messages; this.authorization = authorization; this.friendships = friendships;
    }

    public record Source(boolean available, CanonicalMessage source) { }

    public Source get(UUID actor, UUID room, String bucket, UUID messageId) {
        authorization.requireMember(room, actor);
        MessageReplyPolicy.validateSourceKey(messageId, bucket);
        var copy = messages.find(room, bucket, messageId);
        if (copy == null || !copy.forwarded() || friendships.isBlocked(actor, copy.senderId())) {
            throw new NotFoundException("forwarded message is unavailable");
        }
        try { authorization.requireMember(copy.forwardedFromConversationId(), actor); }
        catch (ForbiddenException | NotFoundException unavailable) { return new Source(false, null); }
        var source = messages.find(copy.forwardedFromConversationId(), copy.forwardedFromMessageBucket(), copy.forwardedFromMessageId());
        if (source == null || Boolean.TRUE.equals(source.isDeleted()) || friendships.isBlocked(actor, source.senderId())) {
            return new Source(false, null);
        }
        return new Source(true, PublicMessageView.withPinned(source,
                messages.findPinState(source.conversationId()).contains(source.messageBucket(), source.messageId())));
    }
}
