package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.messaging.MessageSender;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.model.MessageBucket;
import com.chatapp.chat_service.canonical.notification.NotificationPolicyEvaluator;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.notification.NotificationSettingsPolicy;
import com.chatapp.chat_service.canonical.poll.PollRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ChatPolicyService;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Owns message commands, history, interaction state, notifications and realtime publication. */
@Service
public class MessageService implements MessageSender {
    private static final int HISTORY_BUCKET_SCAN_LIMIT = 256;
    private final CanonicalCqlStore store;
    private final CanonicalConversationRepository conversationRepository;
    private final ConversationAuthorizationService authorization;
    private final CanonicalEventRecorder eventRecorder;
    private final ChatPolicyService chatPolicy;
    private final RealtimePublisher realtime;
    private final NotificationService notifications;
    private final PollRepository polls;
    private final MessageRepository messageRepository;
    private final UserRepository users;
    private final MessageAttachmentPolicy attachmentPolicy;
    private final MessageStickerPolicy stickerPolicy;
    private final MessageReplyPolicy replyPolicy;
    private final MessageForwardPolicy forwardPolicy;

    public MessageService(
            CanonicalCqlStore store,
            CanonicalConversationRepository conversationRepository,
            ConversationAuthorizationService authorization,
            CanonicalEventRecorder eventRecorder,
            ChatPolicyService chatPolicy,
            RealtimePublisher realtime,
            NotificationService notifications,
            PollRepository polls,
            MessageRepository messageRepository,
            UserRepository users,
            MessageAttachmentPolicy attachmentPolicy,
            MessageStickerPolicy stickerPolicy,
            MessageReplyPolicy replyPolicy,
            MessageForwardPolicy forwardPolicy) {
        this.store = store;
        this.conversationRepository = conversationRepository;
        this.authorization = authorization;
        this.eventRecorder = eventRecorder;
        this.chatPolicy = chatPolicy;
        this.realtime = realtime;
        this.notifications = notifications;
        this.polls = polls;
        this.messageRepository = messageRepository;
        this.users = users;
        this.attachmentPolicy = attachmentPolicy;
        this.stickerPolicy = stickerPolicy;
        this.replyPolicy = replyPolicy;
        this.forwardPolicy = forwardPolicy;
    }

    public CanonicalMessage sendMessage(UUID actorId, UUID conversationId, CanonicalApiContracts.MessageSendRequest req) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_SEND);
        if (req == null || req.clientMessageId() == null) {
            throw new BadRequestException("clientMessageId is required");
        }
        if (!StringUtils.hasText(req.messageType())) {
            throw new BadRequestException("messageType is required");
        }
        if (req.content() == null || req.content().length() > 20_000) {
            throw new BadRequestException("content is required and must not exceed 20000 characters");
        }
        if (!StringUtils.hasText(req.contentFormat())) {
            throw new BadRequestException("contentFormat is required");
        }
        String messageType = req.messageType().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO", "STICKER", "GIF", "POLL", "SYSTEM")
                .contains(messageType)) {
            throw new BadRequestException("unsupported messageType");
        }
        stickerPolicy.validateShape(messageType, req);
        MessageGifPolicy.validate(messageType, req);
        MessageReplyPolicy.validateShape(req);
        MessageForwardPolicy.validateShape(req);
        CanonicalConversation conversation = getConversation(conversationId);
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            throw new ConflictException("archived conversations do not accept new messages");
        }
        CanonicalConversationMember member = authorization.requireMember(conversationId, actorId);
        chatPolicy.enforceSend(
                conversation,
                member,
                authorization.effectivePermissions(conversationId, actorId),
                req.clientMessageId());

        String requestFingerprint = MessageRequestFingerprint.sha256(req);
        var previousClaim = messageRepository.findClaim(actorId, req.clientMessageId(), conversationId, requestFingerprint);
        if (previousClaim != null) {
            if (!previousClaim.matchesRequest()) throw new ConflictException("clientMessageId was already used for a different message");
            var committed = messageRepository.find(conversationId, previousClaim.messageBucket(), previousClaim.messageId());
            if (committed != null) {
                repairCommittedMessage(committed, req);
                return PublicMessageView.redact(committed);
            }
        }
        stickerPolicy.validateAvailable(messageType, req);
        CanonicalMessage replySource = replyPolicy.resolve(actorId, conversationId, req);
        CanonicalMessage forwardSource = forwardPolicy.resolve(actorId, req);

        Set<UUID> mentionedUserIds = req.mentionedUserIds() == null
                ? Set.of()
                : Set.copyOf(req.mentionedUserIds());
        List<ConversationMember> conversationMembers = null;
        if (req.mentionEveryone() || !mentionedUserIds.isEmpty()) {
            conversationMembers = conversationRepository.findMembers(conversationId);
            if (conversationMembers == null || conversationMembers.isEmpty()) {
                throw new IllegalStateException("conversation membership is unavailable");
            }
            Set<UUID> memberIds = conversationMembers.stream()
                    .map(ConversationMember::userId)
                    .collect(Collectors.toSet());
            if (!memberIds.containsAll(mentionedUserIds)) {
                throw new BadRequestException("mentioned users must be members of the conversation");
            }
            if (req.mentionEveryone()) {
                mentionedUserIds = memberIds;
            }
        }

        Instant now = Instant.now();
        if (forwardSource == null) attachmentPolicy.validate(actorId, req.attachments());
        else attachmentPolicy.validateForwarded(req.attachments());
        UUID clientMessageId = req.clientMessageId();
        String requestedBucket = MessageBucket.forWrite(now, clientMessageId);
        var claim = messageRepository.claim(
                actorId,
                clientMessageId,
                conversationId,
                requestedBucket,
                requestFingerprint,
                now);
        if (claim == null) {
            throw new ConflictException("message idempotency claim failed; retry with the same clientMessageId");
        }
        if (!claim.matchesRequest()) {
            throw new ConflictException("clientMessageId was already used for a different message");
        }
        if (!claim.claimed()) {
            CanonicalMessage existing = messageRepository.find(conversationId, claim.messageBucket(), claim.messageId());
            if (existing != null) {
                repairCommittedMessage(existing, req);
                return PublicMessageView.redact(existing);
            }
        }

        String bucket = claim.messageBucket();
        UUID assignedMessageId = claim.messageId();
        Instant createdAt = claim.createdAt();

        CanonicalMessage message = new CqlCanonicalRecords.CanonicalMessage(
                conversationId,
                bucket,
                assignedMessageId,
                actorId,
                messageType,
                forwardSource == null ? req.content() : forwardSource.content(),
                forwardSource == null ? req.contentFormat().trim().toUpperCase(Locale.ROOT) : forwardSource.contentFormat(),
                req.replyToMessageId(),
                replySource == null ? null : replySource.senderId(),
                req.stickerId(),
                req.pollId(),
                null,
                forwardSource == null ? null : forwardSource.conversationId(),
                forwardSource == null ? null : forwardSource.messageBucket(),
                forwardSource == null ? null : forwardSource.messageId(),
                false,
                null,
                null,
                null,
                req.attachments() != null && !req.attachments().isEmpty(),
                !mentionedUserIds.isEmpty(),
                false,
                createdAt,
                clientMessageId,
                req.gif(),
                req.replyToMessageBucket(),
                0);
        if (message.hasAttachments()) attachmentPolicy.retainForHistory(req.attachments());
        if (!messageRepository.createIfAbsent(message)) {
            CanonicalMessage existing = messageRepository.find(conversationId, bucket, assignedMessageId);
            if (existing == null) throw new ConflictException("message creation was not applied; retry with the same clientMessageId");
            repairCommittedMessage(existing, req);
            return PublicMessageView.redact(existing);
        }
        messageRepository.saveBucket(message);
        messageRepository.repairSourceProjections(message);
        if (req.attachments() != null) {
            for (var attach : req.attachments()) {
                messageRepository.saveAttachment(message, attach);
            }
        }
        if (!mentionedUserIds.isEmpty()) {
            messageRepository.saveMentions(message, mentionedUserIds);
        }
        CanonicalUser sender = users.findById(actorId);
        if (sender == null) {
            throw new IllegalStateException("authenticated sender does not exist");
        }
        if (conversationMembers == null) {
            conversationMembers = conversationRepository.findMembers(conversationId);
        }
        store.updateLastMessageProjections(message, sender.displayName(), conversationMembers);
        recordMessageEvent(actorId, "MESSAGE_SEND", message, mentionedUserIds);
        notifyConversationMembers(actorId, message, sender, conversationMembers, mentionedUserIds);
        return message;
    }


    private void repairCommittedMessage(CanonicalMessage message, CanonicalApiContracts.MessageSendRequest request) {
        messageRepository.saveBucket(message);
        if (!Boolean.TRUE.equals(message.isDeleted())) {
            messageRepository.repairSourceProjections(message);
            // The matching claim fingerprint freezes the already-authorized attachment snapshot.
            if (request.attachments() != null) {
                for (var attachment : request.attachments()) messageRepository.saveAttachment(message, attachment);
            }
            // The fingerprint freezes explicit recipients. The original @everyone audience is not stored.
            if (Boolean.TRUE.equals(message.hasMentions()) && !request.mentionEveryone()
                    && request.mentionedUserIds() != null && !request.mentionedUserIds().isEmpty()) {
                messageRepository.repairMentionReferences(message, request.mentionedUserIds());
            }
        }
        CanonicalUser sender = users.findById(message.senderId());
        String senderName = null;
        if (sender != null) {
            senderName = StringUtils.hasText(sender.displayName()) ? sender.displayName() : sender.username();
        }
        store.repairCanonicalConversationPreview(PublicMessageView.redact(message), senderName);
    }

    public CanonicalMessage editMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId, CanonicalApiContracts.MessageUpdateRequest req) {
        CanonicalMessage message = messageRepository.find(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (!StringUtils.hasText(req.content()) || req.content().length() > 20_000) {
            throw new BadRequestException("message content is required and must not exceed 20000 characters");
        }
        if (Boolean.TRUE.equals(message.isDeleted())) {
            throw new ConflictException("deleted messages cannot be edited");
        }
        if (!message.senderId().equals(actorId)) {
            throw new ForbiddenException("only sender can edit");
        }
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_EDIT_OWN);
        if (message.forwarded()) throw new BadRequestException("forwarded messages cannot be edited; delete and send another message");
        if (Set.of("STICKER", "GIF").contains(message.messageType())) {
            throw new BadRequestException("sticker and GIF messages cannot be edited; delete and send another message");
        }
        if (!messageRepository.updateContent(conversationId, bucket, messageId, req.content(), actorId)) {
            throw new ConflictException("message changed concurrently; reload and retry");
        }
        CanonicalMessage updated = messageRepository.find(conversationId, bucket, messageId);
        recordMessageEvent(actorId, "MESSAGE_EDIT", updated, null);
        return updated;
    }

    public CanonicalMessage deleteMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        CanonicalMessage message = messageRepository.find(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (!message.senderId().equals(actorId)) {
            throw new ForbiddenException("only sender can delete");
        }
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_DELETE_OWN);
        if (Boolean.TRUE.equals(message.isDeleted())) {
            releaseDeletedMessagePin(actorId, message);
            return PublicMessageView.redact(message);
        }
        if (!messageRepository.delete(conversationId, bucket, messageId, actorId)) {
            var concurrent = messageRepository.find(conversationId, bucket, messageId);
            if (concurrent != null && Boolean.TRUE.equals(concurrent.isDeleted())) {
                releaseDeletedMessagePin(actorId, concurrent);
                return PublicMessageView.redact(concurrent);
            }
            throw new ConflictException("message changed concurrently; reload and retry");
        }
        CanonicalMessage deleted = messageRepository.find(conversationId, bucket, messageId);
        recordMessageEvent(actorId, "MESSAGE_DELETE", deleted, null);
        releaseDeletedMessagePin(actorId, deleted);
        return PublicMessageView.redact(deleted);
    }

    public void reaction(UUID actorId, UUID conversationId, String bucket, UUID messageId, CanonicalApiContracts.MessageReactionRequest req) {
        requireMember(conversationId, actorId);
        if (messageRepository.find(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        if (!StringUtils.hasText(req.emoji()) || req.emoji().codePointCount(0, req.emoji().length()) > 8) {
            throw new BadRequestException("emoji is required and must contain at most 8 code points");
        }
        if (messageRepository.addReaction(conversationId, bucket, messageId, actorId, req.emoji())) {
            appendAudit(actorId, conversationId, "MESSAGE_REACTION_ADD", "message", messageId.toString(), null, null);
            publishConversationEvent(conversationId, "/reactions", Map.of(
                    "messageId", messageId.toString(), "messageBucket", bucket,
                    "emoji", req.emoji(), "userId", actorId.toString(), "action", "ADD"));
        }
    }

    public void removeReaction(
            UUID actorId, UUID conversationId, String bucket, UUID messageId, String emoji) {
        requireMember(conversationId, actorId);
        if (messageRepository.find(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        if (!StringUtils.hasText(emoji) || emoji.codePointCount(0, emoji.length()) > 8) {
            throw new BadRequestException("emoji is required and must contain at most 8 code points");
        }
        if (messageRepository.removeReaction(conversationId, bucket, messageId, actorId, emoji)) {
            appendAudit(actorId, conversationId, "MESSAGE_REACTION_REMOVE", "message", messageId.toString(), null, null);
            publishConversationEvent(conversationId, "/reactions", Map.of(
                    "messageId", messageId.toString(), "messageBucket", bucket,
                    "emoji", emoji, "userId", actorId.toString(), "action", "REMOVE"));
        }
    }

    public CanonicalApiContracts.MessagePinStateView getMessagePins(UUID actor, UUID room) {
        requireMember(room, actor);
        var state = messageRepository.findPinState(room);
        boolean repaired = false;
        for (var slot : state.slots()) {
            var message = messageRepository.find(room, slot.bucket(), slot.message());
            if (message != null && Boolean.TRUE.equals(message.isDeleted())) {
                releaseDeletedMessagePin(actor, message);
                repaired = true;
            }
        }
        return pinView(room, repaired ? messageRepository.findPinState(room) : state);
    }

    public CanonicalApiContracts.MessagePinMutationView pinMessage(UUID actor, UUID room, String bucket, UUID id,
            CanonicalApiContracts.MessagePinRequest request) {
        return changePin(actor, room, bucket, id, true, request);
    }

    public CanonicalApiContracts.MessagePinMutationView unpinMessage(UUID actor, UUID room, String bucket, UUID id,
            CanonicalApiContracts.MessagePinRequest request) {
        return changePin(actor, room, bucket, id, false, request);
    }

    private CanonicalApiContracts.MessagePinMutationView changePin(UUID actor, UUID room, String bucket, UUID id,
            boolean pinned, CanonicalApiContracts.MessagePinRequest request) {
        authorization.requirePermission(room, actor, ConversationPermission.MESSAGE_PIN);
        long expected;
        try {
            if (request == null || request.expectedRevision() == null
                    || !request.expectedRevision().matches("0|[1-9][0-9]{0,18}")) throw new NumberFormatException();
            expected = Long.parseLong(request.expectedRevision());
        } catch (NumberFormatException invalid) {
            throw new BadRequestException("expected pin revision is invalid");
        }
        var current = messageRepository.find(room, bucket, id);
        if (current == null) throw new NotFoundException("message not found");
        if (pinned && Boolean.TRUE.equals(current.isDeleted())) throw new ConflictException("deleted messages cannot be pinned");
        var change = messageRepository.changePin(room, bucket, id, actor, pinned, expected);
        var fresh = messageRepository.find(room, bucket, id);
        if (fresh == null) throw new ConflictException("message changed during pin update; reload and retry");
        if (pinned && Boolean.TRUE.equals(fresh.isDeleted())) {
            releaseDeletedMessagePin(actor, fresh);
            throw new ConflictException("message was deleted during pin update");
        }
        var updated = PublicMessageView.withPinned(fresh, change.state().contains(bucket, id));
        var state = pinView(room, change.state());
        if (change.changed()) {
            recordMessageProjectionEvent(actor, pinned ? "MESSAGE_PIN" : "MESSAGE_UNPIN", updated, null, state);
            publishConversationEvent(room, "/pins", state);
        }
        return new CanonicalApiContracts.MessagePinMutationView(updated, state);
    }

    private CanonicalApiContracts.MessagePinStateView pinView(UUID room, MessageRepository.PinState state) {
        return new CanonicalApiContracts.MessagePinStateView(room, Long.toString(state.revision()),
                state.slots().stream().map(slot -> new CanonicalApiContracts.MessagePinReference(slot.message(), slot.bucket())).toList());
    }

    private void releaseDeletedMessagePin(UUID actor, CanonicalMessage deleted) {
        var change = DeletedMessagePins.release(messageRepository, deleted, actor);
        if (!change.changed()) return;
        var state = pinView(deleted.conversationId(), change.state());
        recordMessageProjectionEvent(actor, "MESSAGE_UNPIN", deleted, null, state);
        publishConversationEvent(deleted.conversationId(), "/pins", state);
    }


    public CanonicalMessage getMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        requireMember(conversationId, actorId);
        CanonicalMessage message = messageRepository.find(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        return publicMessages(conversationId, List.of(message)).get(0);
    }

    public List<CanonicalMessage> listMessages(UUID actorId, UUID conversationId, String bucket, int limit) {
        requireMember(conversationId, actorId);
        return publicMessages(conversationId,
                messageRepository.findByBucket(conversationId, bucket, Math.max(1, Math.min(100, limit))));
    }

    public CanonicalApiContracts.MessagePage listMessageHistory(
            UUID actorId,
            UUID conversationId,
            int requestedLimit,
            String cursor) {
        requireMember(conversationId, actorId);
        int limit = Math.max(1, Math.min(100, requestedLimit));
        MessageCursor decoded = decodeMessageCursor(cursor);
        Instant cursorHour = decoded == null ? null : decoded.createdAt().truncatedTo(ChronoUnit.HOURS);
        List<MessageRepository.MessageBucket> buckets = messageRepository.findBuckets(
                conversationId, cursorHour, HISTORY_BUCKET_SCAN_LIMIT + 1);
        // Never advance within an hour whose shard list was truncated by the metadata limit.
        Instant nextHour = buckets.size() > HISTORY_BUCKET_SCAN_LIMIT
                ? buckets.get(HISTORY_BUCKET_SCAN_LIMIT).bucketHour() : null;
        List<CanonicalMessage> candidates = new ArrayList<>();
        Instant scannedHour = null;
        for (MessageRepository.MessageBucket bucket : buckets) {
            if (bucket.bucketHour().equals(nextHour)
                    || (candidates.size() > limit && !bucket.bucketHour().equals(scannedHour))) break;
            scannedHour = bucket.bucketHour();
            boolean cursorBucketHour = decoded != null && decoded.messageId() != null
                    && bucket.bucketHour().equals(cursorHour);
            List<CanonicalMessage> messages = cursorBucketHour
                    ? messageRepository.findByBucketBefore(
                            conversationId, bucket.value(), decoded.messageId(), limit + 1)
                    : messageRepository.findByBucket(conversationId, bucket.value(), limit + 1);
            candidates.addAll(messages);
        }
        candidates.sort(Comparator
                .comparing(CanonicalMessage::createdAt)
                .thenComparing(CanonicalMessage::messageId, MessageOrder::compare)
                .reversed());
        boolean moreMessages = candidates.size() > limit;
        List<CanonicalMessage> content = moreMessages
                ? List.copyOf(candidates.subList(0, limit))
                : List.copyOf(candidates);
        String nextCursor = moreMessages
                ? encodeMessageCursor(content.get(content.size() - 1))
                : nextHour == null ? null : encodeHistoryCursor("h|" + nextHour.toEpochMilli());
        Map<String, List<UUID>> messageIdsByBucket = content.stream()
                .collect(Collectors.groupingBy(
                        CanonicalMessage::messageBucket,
                        LinkedHashMap::new,
                        Collectors.mapping(CanonicalMessage::messageId, Collectors.toList())));
        List<CanonicalApiContracts.MessageInteractionView> interactions = messageIdsByBucket.entrySet()
                .stream()
                .flatMap(entry -> messageRepository.findInteractions(
                        conversationId, entry.getKey(), entry.getValue(), actorId).stream())
                .toList();
        List<UUID> pollIds = content.stream()
                .filter(message -> !Boolean.TRUE.equals(message.isDeleted()))
                .map(CanonicalMessage::pollId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        List<CanonicalApiContracts.PollView> polls = pollViews(actorId, pollIds);
        return new CanonicalApiContracts.MessagePage(
                publicMessages(conversationId, content),
                nextCursor, nextCursor != null, interactions, polls);
    }

    private List<CanonicalMessage> publicMessages(UUID room, List<CanonicalMessage> messages) {
        if (messages.stream().allMatch(message -> Boolean.TRUE.equals(message.isDeleted()))) {
            return messages.stream().map(PublicMessageView::redact).toList();
        }
        var pins = messageRepository.findPinState(room);
        return messages.stream().map(message -> PublicMessageView.withPinned(message,
                pins.contains(message.messageBucket(), message.messageId()))).toList();
    }

    private String encodeMessageCursor(CanonicalMessage message) {
        return encodeHistoryCursor(message.createdAt().toEpochMilli() + "|" + message.messageId());
    }

    private String encodeHistoryCursor(String value) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private MessageCursor decodeMessageCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            if (cursor.length() > 96) throw new IllegalArgumentException("invalid cursor length");
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (value.startsWith("h|")) {
                Instant hour = Instant.ofEpochMilli(Long.parseLong(value.substring(2)));
                if (!hour.equals(hour.truncatedTo(ChronoUnit.HOURS))) {
                    throw new IllegalArgumentException("invalid cursor hour");
                }
                return new MessageCursor(hour, null);
            }
            int separator = value.indexOf('|');
            if (separator <= 0 || separator == value.length() - 1) {
                throw new IllegalArgumentException("invalid cursor");
            }
            UUID messageId = UUID.fromString(value.substring(separator + 1));
            if (messageId.version() != 1) throw new IllegalArgumentException("invalid cursor message ID");
            return new MessageCursor(Instant.ofEpochMilli(Long.parseLong(value.substring(0, separator))), messageId);
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("invalid message cursor");
        }
    }

    private record MessageCursor(Instant createdAt, UUID messageId) {
    }

    public void markMessageRead(
            UUID actorId,
            UUID conversationId,
            String bucket,
            UUID messageId) {
        CanonicalConversationMember member = store.findConversationMember(conversationId, actorId);
        if (member == null) {
            throw new ForbiddenException("not member of conversation");
        }
        CanonicalMessage message = messageRepository.find(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (member.lastReadMessageId() != null
                && MessageOrder.compare(member.lastReadMessageId(), messageId) > 0) {
            return;
        }
        Instant readAt = Instant.now();
        boolean ownMessage = actorId.equals(message.senderId());
        boolean advanced = ownMessage
                ? messageRepository.advanceReadPosition(conversationId, actorId, messageId, member.joinedAt(), readAt)
                : messageRepository.markRead(conversationId, bucket, messageId, actorId, member.joinedAt(), readAt);
        if (!advanced) return;
        store.clearReadConversationProjection(actorId, conversationId, messageId, member.joinedAt());
        if (ownMessage) return; // Advancing past your own message must not create a false 'seen' receipt.
        publishConversationEvent(conversationId, "/read", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "readerId", actorId.toString(), "readAt", readAt.toString()));
    }

    public CanonicalApiContracts.MessageReadReceiptPage listMessageReadReceipts(
            UUID actorId,
            UUID conversationId,
            String bucket,
            UUID messageId,
            int requestedLimit,
            UUID cursor) {
        requireMember(conversationId, actorId);
        if (messageRepository.find(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        int limit = Math.max(1, Math.min(50, requestedLimit));
        List<MessageRepository.ReadReceipt> rows = messageRepository.findReadReceipts(
                conversationId, bucket, messageId, cursor, limit + 1);
        boolean hasNext = rows.size() > limit;
        List<MessageRepository.ReadReceipt> pageRows = hasNext
                ? List.copyOf(rows.subList(0, limit))
                : List.copyOf(rows);
        Map<UUID, UserRepository.UserProfile> usersById = users.findProfilesByIds(pageRows.stream()
                .map(MessageRepository.ReadReceipt::readerId)
                .distinct()
                .toList()).stream()
                .collect(Collectors.toMap(UserRepository.UserProfile::userId, user -> user));
        List<CanonicalApiContracts.MessageReadReceiptView> content = pageRows.stream()
                .map(row -> {
                    UserRepository.UserProfile user = usersById.get(row.readerId());
                    return new CanonicalApiContracts.MessageReadReceiptView(
                            row.readerId(),
                            user == null ? null : user.username(),
                            user == null ? null : user.displayName(),
                            user == null ? null : user.avatarUrl(),
                            row.readAt());
                })
                .toList();
        UUID nextCursor = hasNext && !pageRows.isEmpty()
                ? pageRows.get(pageRows.size() - 1).readerId()
                : null;
        return new CanonicalApiContracts.MessageReadReceiptPage(content, nextCursor, hasNext);
    }

    public List<CanonicalApiContracts.MessageRevisionView> listMessageRevisions(
            UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        requireMember(conversationId, actorId);
        CanonicalMessage message = messageRepository.find(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        if (Boolean.TRUE.equals(message.isDeleted())) return List.of();
        return messageRepository.findRevisions(conversationId, bucket, messageId);
    }

    private List<CanonicalApiContracts.PollView> pollViews(UUID actorId, List<UUID> pollIds) {
        if (pollIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, CanonicalPoll> pollsById = polls.findByIds(pollIds).stream()
                .collect(Collectors.toMap(CanonicalPoll::pollId, poll -> poll));
        Map<UUID, PollRepository.PollState> statesById = polls.findStates(pollIds, actorId);
        return pollIds.stream().map(pollId -> {
            CanonicalPoll poll = pollsById.get(pollId);
            PollRepository.PollState state = statesById.get(pollId);
            if (poll == null || state == null) {
                throw new IllegalStateException("poll projection is incomplete");
            }
            return new CanonicalApiContracts.PollView(
                    poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters());
        }).toList();
    }


    private void requireMember(UUID conversationId, UUID userId) {
        if (store.findConversationMember(conversationId, userId) == null) {
            throw new ForbiddenException("not member of conversation");
        }
    }

    private CanonicalConversation getConversation(UUID conversationId) {
        CanonicalConversation conversation = store.findConversation(conversationId);
        if (conversation == null) {
            throw new NotFoundException("conversation not found");
        }
        return conversation;
    }

    private void appendAudit(
            UUID actorId,
            UUID conversationId,
            String action,
            String resourceType,
            String resourceId,
            UUID targetUserId,
            String reason) {
        eventRecorder.record(
                actorId, conversationId, action, resourceType, resourceId,
                targetUserId, reason, Map.of(), Map.of());
    }

    private void recordMessageEvent(
            UUID actorId, String action, CanonicalMessage message, Set<UUID> mentionedUserIds) {
        recordMessageProjectionEvent(actorId, action, message, mentionedUserIds, null);
        publishMessageEvent(action, message);
    }

    private void recordMessageProjectionEvent(
            UUID actorId, String action, CanonicalMessage message, Set<UUID> mentionedUserIds,
            CanonicalApiContracts.MessagePinStateView pinState) {
        message = PublicMessageView.redact(message);
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("messageId", message.messageId().toString());
        payload.put("messageBucket", message.messageBucket());
        payload.put("senderId", message.senderId().toString());
        payload.put("messageType", message.messageType());
        payload.put("content", message.content());
        payload.put("revision", message.revision());
        if (pinState != null) payload.put("pinRevision", pinState.revision());
        payload.put("replyToSenderId", message.replyToSenderId() == null ? null : message.replyToSenderId().toString());
        payload.put("hasAttachments", Boolean.TRUE.equals(message.hasAttachments()));
        payload.put("hasMentions", Boolean.TRUE.equals(message.hasMentions()));
        payload.put("isPinned", Boolean.TRUE.equals(message.isPinned()));
        payload.put("isDeleted", Boolean.TRUE.equals(message.isDeleted()));
        payload.put("createdAt", message.createdAt().toString());
        if (mentionedUserIds != null) {
            payload.put("mentionedUserIds", mentionedUserIds.stream().map(UUID::toString).toList());
        }
        eventRecorder.record(
                actorId, message.conversationId(), action, "message", message.messageId().toString(),
                null, null, Map.of(), Map.of(), payload);
    }

    private void notifyConversationMembers(
            UUID actorId,
            CanonicalMessage message,
            CanonicalUser sender,
            List<ConversationMember> members,
            Set<UUID> mentionedUserIds) {
        if (members == null || members.isEmpty()) {
            return;
        }
        if (sender == null) {
            throw new IllegalStateException("message sender does not exist");
        }
        if (!StringUtils.hasText(sender.displayName())) {
            throw new IllegalStateException("message sender displayName is missing");
        }
        String senderName = sender.displayName().trim();
        String body = switch (message.messageType()) {
            case "STICKER" -> "Sticker";
            case "GIF" -> "GIF";
            default -> message.content().trim();
        };
        String preview = body.length() > 160 ? body.substring(0, 157) + "..." : body;
        CanonicalConversation conversation = getConversation(message.conversationId());
        String roomDefaultLevel = NotificationSettingsPolicy.requireRoomLevel(conversation.defaultNotificationLevel());
        String month = YearMonth.now(ZoneOffset.UTC).toString();
        for (ConversationMember member : members) {
            UUID recipientId = member.userId();
            if (recipientId == null || recipientId.equals(actorId)) {
                continue;
            }
            boolean mention = mentionedUserIds != null && mentionedUserIds.contains(recipientId);
            CanonicalNotificationSettings settings = notifications.getSettings(recipientId);
            if (!NotificationPolicyEvaluator.allows(
                    settings.globalLevel(),
                    roomDefaultLevel,
                    member.notificationOverride(),
                    conversation.conversationType(),
                    mention)) {
                continue;
            }
            UUID notificationId = Uuids.timeBased();
            CanonicalNotification notification = new CanonicalNotification(
                    recipientId,
                    month,
                    notificationId,
                    mention ? "MENTION" : "MESSAGE",
                    "NORMAL",
                    message.conversationId(),
                    message.messageBucket(),
                    message.messageId(),
                    actorId,
                    senderName,
                    preview,
                    "/app?conversation=" + message.conversationId(),
                    Map.of("conversationId", message.conversationId().toString(),
                            "messageId", message.messageId().toString(),
                            "messageBucket", message.messageBucket(),
                            "messageType", message.messageType()),
                    false,
                    null,
                    Instant.now());
            notifications.publish(notification);
        }
    }

    private void publishMessageEvent(String action, CanonicalMessage message) {
        message = PublicMessageView.redact(message);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", action);
        payload.put("conversationId", message.conversationId().toString());
        payload.put("messageId", message.messageId().toString());
        payload.put("messageBucket", message.messageBucket());
        payload.put("clientMessageId", message.clientMessageId() == null ? null : message.clientMessageId().toString());
        payload.put("senderId", message.senderId().toString());
        payload.put("messageType", message.messageType());
        payload.put("content", message.content());
        payload.put("contentFormat", message.contentFormat());
        payload.put("revision", message.revision());
        payload.put("replyToMessageId", message.replyToMessageId() == null ? null : message.replyToMessageId().toString());
        payload.put("replyToMessageBucket", message.replyToMessageBucket());
        payload.put("replyToSenderId", message.replyToSenderId() == null ? null : message.replyToSenderId().toString());
        payload.put("stickerId", message.stickerId() == null ? null : message.stickerId().toString());
        payload.put("gif", message.gif());
        payload.put("pollId", message.pollId() == null ? null : message.pollId().toString());
        payload.put("systemEventId", message.systemEventId() == null ? null : message.systemEventId().toString());
        payload.put("forwarded", message.forwarded());
        payload.put("createdAt", message.createdAt().toString());
        payload.put("editedAt", message.editedAt() == null ? null : message.editedAt().toString());
        payload.put("deletedBy", message.deletedBy() == null ? null : message.deletedBy().toString());
        payload.put("deletedAt", message.deletedAt() == null ? null : message.deletedAt().toString());
        payload.put("isDeleted", Boolean.TRUE.equals(message.isDeleted()));
        payload.put("isPinned", Boolean.TRUE.equals(message.isPinned()));
        payload.put("hasAttachments", Boolean.TRUE.equals(message.hasAttachments()));
        payload.put("hasMentions", Boolean.TRUE.equals(message.hasMentions()));
        publishConversationEvent(message.conversationId(), "", payload);
    }

    private void publishConversationEvent(UUID conversationId, String suffix, Object payload) {
        realtime.publishToConversation(conversationId, suffix, payload);
    }


}
