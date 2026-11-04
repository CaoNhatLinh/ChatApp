package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.UUID;

/** Resolves reply sources only after the caller has authorized the current conversation. */
@Component
public class MessageReplyPolicy {
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("uuuu-MM-dd-HH:mm")
            .withResolverStyle(ResolverStyle.STRICT);
    private final MessageRepository messages;
    private final FriendshipRepository friendships;

    public MessageReplyPolicy(MessageRepository messages, FriendshipRepository friendships) {
        this.messages = messages;
        this.friendships = friendships;
    }

    public static void validateShape(MessageSendRequest request) {
        UUID id = request.replyToMessageId();
        String bucket = request.replyToMessageBucket();
        if (id == null && bucket == null) return;
        validateSourceKey(id, bucket);
    }

    static void validateSourceKey(UUID id, String bucket) {
        if (id == null || id.version() != 1 || bucket == null
                || !bucket.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}:[0-9]{2}")) {
            throw new BadRequestException("reply requires a timeuuid message ID and canonical message bucket");
        }
        try {
            LocalDateTime.parse(bucket.substring(0, 13) + ":00", HOUR);
            if (Integer.parseInt(bucket.substring(14)) > 15) {
                throw new BadRequestException("reply message bucket shard must be between 00 and 15");
            }
        } catch (DateTimeParseException invalid) {
            throw new BadRequestException("reply message bucket is invalid");
        }
    }

    public CanonicalMessage resolve(UUID actorId, UUID conversationId, MessageSendRequest request) {
        if (request.replyToMessageId() == null) return null;
        CanonicalMessage parent = messages.find(conversationId, request.replyToMessageBucket(), request.replyToMessageId());
        if (parent == null || Boolean.TRUE.equals(parent.isDeleted())
                || friendships.isBlocked(actorId, parent.senderId())) {
            throw new NotFoundException("reply source is unavailable");
        }
        return parent;
    }
}
