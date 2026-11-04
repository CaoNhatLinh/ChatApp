package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.*;

/** Index traversal is bounded even when authority hydration filters an entire page. */
@Service
public class MessageThreadService {
    private final ConversationAuthorizationService authorization;
    private final MessageRepository messages;
    private final FriendshipRepository friendships;

    public MessageThreadService(ConversationAuthorizationService authorization, MessageRepository messages,
                                FriendshipRepository friendships) {
        this.authorization = authorization;
        this.messages = messages;
        this.friendships = friendships;
    }

    public record Page(CanonicalMessage parent, List<CanonicalMessage> content, String nextCursor, boolean hasNext) { }

    public Page list(UUID actor, UUID room, String parentBucket, UUID parentId, int limit, String cursor) {
        authorization.requireMember(room, actor);
        MessageReplyPolicy.validateSourceKey(parentId, parentBucket);
        if (limit < 1 || limit > 50) throw new BadRequestException("thread limit must be between 1 and 50");
        var after = decode(cursor, actor, room, parentBucket, parentId);
        var parent = messages.find(room, parentBucket, parentId);
        var blocked = new HashMap<UUID, Boolean>();
        if (parent == null || isBlocked(actor, parent.senderId(), blocked)) {
            throw new NotFoundException("thread source is unavailable");
        }
        var references = messages.findReplies(room, parentBucket, parentId, after, limit + 1);
        int consumed = Math.min(limit, references.size());
        var content = new ArrayList<CanonicalMessage>();
        for (var reference : references.subList(0, consumed)) {
            var message = messages.find(room, reference.messageBucket(), reference.messageId());
            if (message != null && room.equals(message.conversationId())
                    && parentId.equals(message.replyToMessageId()) && parentBucket.equals(message.replyToMessageBucket())
                    && !isBlocked(actor, message.senderId(), blocked)) {
                content.add(message);
            }
        }
        boolean hasNext = references.size() > limit;
        String next = hasNext ? encode(actor, room, parentBucket, parentId, references.get(consumed - 1)) : null;
        var pins = messages.findPinState(room);
        return new Page(PublicMessageView.withPinned(parent, pins.contains(parentBucket, parentId)),
                content.stream().map(message -> PublicMessageView.withPinned(message,
                        pins.contains(message.messageBucket(), message.messageId()))).toList(), next, hasNext);
    }

    private boolean isBlocked(UUID actor, UUID sender, Map<UUID, Boolean> blocked) {
        return !actor.equals(sender) && blocked.computeIfAbsent(sender, id -> friendships.isBlocked(actor, id));
    }

    private static String encode(UUID actor, UUID room, String bucket, UUID parent, MessageRepository.ReplyReference row) {
        String value = String.join("|", "v1", actor.toString(), room.toString(), bucket, parent.toString(),
                row.createdAt().toString(), row.messageId().toString());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static MessageRepository.ReplyPosition decode(String cursor, UUID actor, UUID room, String bucket, UUID parent) {
        if (cursor == null) return null;
        try {
            if (cursor.length() > 1024) throw new IllegalArgumentException();
            String[] fields = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
            if (fields.length != 7 || !fields[0].equals("v1") || !fields[1].equals(actor.toString())
                    || !fields[2].equals(room.toString()) || !fields[3].equals(bucket) || !fields[4].equals(parent.toString())) {
                throw new IllegalArgumentException();
            }
            UUID createdAt = UUID.fromString(fields[5]), messageId = UUID.fromString(fields[6]);
            if (createdAt.version() != 1 || messageId.version() != 1) throw new IllegalArgumentException();
            return new MessageRepository.ReplyPosition(createdAt, messageId);
        } catch (IllegalArgumentException invalid) {
            throw new BadRequestException("invalid thread cursor");
        }
    }
}
