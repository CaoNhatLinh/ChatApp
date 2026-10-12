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
            MessageAttachmentPolicy attachmentPolicy) {
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
        if (!Set.of("TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO", "STICKER", "POLL", "SYSTEM")
                .contains(messageType)) {
            throw new BadRequestException("unsupported messageType");
        }
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
        attachmentPolicy.validate(actorId, req.attachments());
        UUID clientMessageId = req.clientMessageId();
        String requestedBucket = MessageBucket.forWrite(now, clientMessageId);
        var claim = messageRepository.claim(
                actorId,
                clientMessageId,
                conversationId,
                requestedBucket,
                MessageRequestFingerprint.sha256(req),
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
                messageRepository.saveBucket(existing);
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
                req.content(),
                req.contentFormat().trim().toUpperCase(Locale.ROOT),
                req.replyToMessageId(),
                req.replyToSenderId(),
                req.stickerId(),
                req.pollId(),
                null,
                req.forwardedFromConversationId(),
                req.forwardedFromMessageBucket(),
                req.forwardedFromMessageId(),
                false,
                null,
                null,
                null,
                req.attachments() != null && !req.attachments().isEmpty(),
                !mentionedUserIds.isEmpty(),
                false,
                createdAt,
                clientMessageId
        );
        messageRepository.save(message);
        if (req.attachments() != null) {
            for (var attach : req.attachments()) {
                messageRepository.saveAttachment(message, attach);
                publishConversationEvent(message.conversationId(), "/attachments", Map.of(
                        "messageId", message.messageId().toString(),
                        "messageBucket", message.messageBucket(),
                        "attachment", attach,
                        "addedBy", actorId.toString()));
            }
        }
        if (!mentionedUserIds.isEmpty()) {
            messageRepository.saveMentions(message, mentionedUserIds);
        }
        if (claim.claimed()) {
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
        }
        return message;
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
            return PublicMessageView.redact(message);
        }
        if (!messageRepository.delete(conversationId, bucket, messageId, actorId)) {
            throw new ConflictException("message changed concurrently; reload and retry");
        }
        CanonicalMessage deleted = messageRepository.find(conversationId, bucket, messageId);
        recordMessageEvent(actorId, "MESSAGE_DELETE", deleted, null);
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

    public CanonicalMessage pinMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_PIN);
        CanonicalMessage current = messageRepository.find(conversationId, bucket, messageId);
        if (current == null) {
            throw new NotFoundException("message not found");
        }
        if (Boolean.TRUE.equals(current.isDeleted())) throw new ConflictException("deleted messages cannot be pinned");
        if (!messageRepository.setPinned(conversationId, bucket, messageId, actorId, true)) {
            throw new ConflictException("a conversation can have at most 5 pinned messages");
        }
        CanonicalMessage updated = PublicMessageView.redact(messageRepository.find(conversationId, bucket, messageId));
        recordMessageProjectionEvent(actorId, "MESSAGE_PIN", updated, null);
        publishConversationEvent(conversationId, "/pins", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "pinnedBy", actorId.toString(), "action", "PIN"));
        return updated;
    }

    public CanonicalMessage unpinMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.MESSAGE_PIN);
        if (messageRepository.find(conversationId, bucket, messageId) == null) {
            throw new NotFoundException("message not found");
        }
        messageRepository.setPinned(conversationId, bucket, messageId, actorId, false);
        CanonicalMessage updated = PublicMessageView.redact(messageRepository.find(conversationId, bucket, messageId));
        recordMessageProjectionEvent(actorId, "MESSAGE_UNPIN", updated, null);
        publishConversationEvent(conversationId, "/pins", Map.of(
                "messageId", messageId.toString(), "messageBucket", bucket,
                "pinnedBy", actorId.toString(), "action", "UNPIN"));
        return updated;
    }


    public CanonicalMessage getMessage(UUID actorId, UUID conversationId, String bucket, UUID messageId) {
        requireMember(conversationId, actorId);
        CanonicalMessage message = messageRepository.find(conversationId, bucket, messageId);
        if (message == null) {
            throw new NotFoundException("message not found");
        }
        return PublicMessageView.redact(message);
    }

    public List<CanonicalMessage> listMessages(UUID actorId, UUID conversationId, String bucket, int limit) {
        requireMember(conversationId, actorId);
        return messageRepository.findByBucket(conversationId, bucket, Math.max(1, Math.min(100, limit)))
                .stream().map(PublicMessageView::redact).toList();
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
                conversationId, cursorHour, 256);
        List<CanonicalMessage> candidates = new ArrayList<>();
        for (MessageRepository.MessageBucket bucket : buckets) {
            boolean cursorBucketHour = decoded != null && bucket.bucketHour().equals(cursorHour);
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
        boolean hasNext = candidates.size() > limit || buckets.size() == 256;
        List<CanonicalMessage> content = candidates.size() > limit
                ? List.copyOf(candidates.subList(0, limit))
                : List.copyOf(candidates);
        String nextCursor = hasNext && !content.isEmpty()
                ? encodeMessageCursor(content.get(content.size() - 1))
                : null;
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
                content.stream().map(PublicMessageView::redact).toList(),
                nextCursor, hasNext && nextCursor != null, interactions, polls);
    }

    private String encodeMessageCursor(CanonicalMessage message) {
        String value = message.createdAt().toEpochMilli() + "|" + message.messageId();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private MessageCursor decodeMessageCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = value.indexOf('|');
            if (separator <= 0 || separator == value.length() - 1) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new MessageCursor(
                    Instant.ofEpochMilli(Long.parseLong(value.substring(0, separator))),
                    UUID.fromString(value.substring(separator + 1)));
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
        if (!messageRepository.markRead(conversationId, bucket, messageId, actorId, readAt)) return;
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
        recordMessageProjectionEvent(actorId, action, message, mentionedUserIds);
        publishMessageEvent(action, message);
    }

    private void recordMessageProjectionEvent(
            UUID actorId, String action, CanonicalMessage message, Set<UUID> mentionedUserIds) {
        message = PublicMessageView.redact(message);
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("messageId", message.messageId().toString());
        payload.put("messageBucket", message.messageBucket());
        payload.put("senderId", message.senderId().toString());
        payload.put("messageType", message.messageType());
        payload.put("content", message.content());
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
        String body = message.content().trim();
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
                            "messageBucket", message.messageBucket()),
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
        payload.put("replyToMessageId", message.replyToMessageId() == null ? null : message.replyToMessageId().toString());
        payload.put("replyToSenderId", message.replyToSenderId() == null ? null : message.replyToSenderId().toString());
        payload.put("stickerId", message.stickerId() == null ? null : message.stickerId().toString());
        payload.put("pollId", message.pollId() == null ? null : message.pollId().toString());
        payload.put("systemEventId", message.systemEventId() == null ? null : message.systemEventId().toString());
        payload.put("forwardedFromConversationId", message.forwardedFromConversationId() == null ? null : message.forwardedFromConversationId().toString());
        payload.put("forwardedFromMessageBucket", message.forwardedFromMessageBucket());
        payload.put("forwardedFromMessageId", message.forwardedFromMessageId() == null ? null : message.forwardedFromMessageId().toString());
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
