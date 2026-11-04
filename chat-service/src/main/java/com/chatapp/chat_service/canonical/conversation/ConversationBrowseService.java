package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Bounded member directory scan; continuation follows scanned, not matching, rows. */
@Service
public class ConversationBrowseService {
    private static final int MAX_DIRECTORY_REPAIRS_PER_PAGE = 3;
    private final CanonicalCqlStore store;
    private final UserRepository users;
    private final MessageRepository messages;

    public ConversationBrowseService(CanonicalCqlStore store, UserRepository users, MessageRepository messages) {
        this.store = store;
        this.users = users;
        this.messages = messages;
    }

    /** Same member-scoped view as the directory, without scanning earlier pages. */
    public CanonicalApiContracts.ConversationListItem get(UUID actor, UUID conversationId) {
        if (actor == null) throw new ForbiddenException("auth required");
        for (int attempt = 0; attempt < 3; attempt++) {
            if (store.findConversationMember(conversationId, actor) == null) {
                throw new ForbiddenException("conversation membership required");
            }
            var conversation = store.findConversation(conversationId);
            if (conversation == null) throw new NotFoundException("conversation not found");
            var row = store.findConversationProjectionAtActivity(actor, conversation);
            if (row == null || row.conversation() == null
                    || !java.util.Objects.equals(row.lastActivityAt(), row.conversation().lastActivityAt())) continue;
            var view = toView(actor, row, row.pinned(), true);
            if (view == null) throw new ForbiddenException("conversation membership required");
            return view;
        }
        throw new ConflictException("conversation summary changed; retry the read");
    }

    public CanonicalApiContracts.ConversationPage list(UUID actor, String cursor, int requestedLimit, String query, String filter) {
        if (actor == null) throw new ForbiddenException("auth required");
        if (query != null && query.length() > 100) throw new BadRequestException("conversation query must not exceed 100 characters");
        if (!Set.of("ALL", "UNREAD", "PINNED").contains(filter)) throw new BadRequestException("invalid conversation filter");
        String q = normalize(query);
        String scope = actor + "|" + filter + "|" + encode(q) + "|";
        var page = store.scanConversationProjectionByUser(actor, decode(cursor, scope), Math.max(10, Math.min(100, requestedLimit)));
        Set<UUID> pinnedIds = page.content().isEmpty() ? Set.of() : store.findPinnedConversationIds(actor);
        var rooms = new LinkedHashMap<UUID, CanonicalCqlStore.ConversationProjectionRow>();
        for (var row : page.content()) {
            if (row.conversation() == null) continue;
            UUID roomId = row.conversation().conversationId();
            rooms.merge(roomId, row, (first, duplicate) -> preferredProjection(first, duplicate, pinnedIds.contains(roomId)));
        }
        repairProjections(actor, rooms.values(), pinnedIds);
        List<CanonicalApiContracts.ConversationListItem> content = rooms.values().stream()
                .filter(row -> !"PINNED".equals(filter) || pinnedIds.contains(row.conversation().conversationId()))
                .map(row -> toView(actor, row, pinnedIds.contains(row.conversation().conversationId()), false))
                .filter(java.util.Objects::nonNull)
                .filter(item -> !"UNREAD".equals(filter) || item.unreadCount() > 0)
                .filter(item -> q.isEmpty() || normalize(item.conversation().name()).contains(q)
                        || item.peer() != null && (normalize(item.peer().displayName()).contains(q)
                        || normalize(item.peer().username()).contains(q)))
                .toList();
        var next = page.nextCursor();
        String continuation = page.hasNext() && next != null
                ? encode(scope + (next.pinned() ? "1" : "0") + "|" + next.lastActivityAt() + "|" + next.conversationId()) : null;
        return new CanonicalApiContracts.ConversationPage(content, continuation, page.hasNext());
    }

    private void repairProjections(UUID actor, Iterable<CanonicalCqlStore.ConversationProjectionRow> rows,
                                   Set<UUID> pinnedIds) {
        int attempts = 0;
        for (var row : rows) {
            boolean pinned = pinnedIds.contains(row.conversation().conversationId());
            if (row.pinned() == pinned || !java.util.Objects.equals(row.lastActivityAt(), row.conversation().lastActivityAt())) continue;
            store.repairConversationProjectionPin(actor, row, pinned);
            if (++attempts == MAX_DIRECTORY_REPAIRS_PER_PAGE) return;
        }
        for (var row : rows) {
            Instant observed = row.lastActivityAt();
            Instant current = row.conversation().lastActivityAt();
            if (row.lastMessage() == null || observed == null || current == null || !observed.isBefore(current)) continue;
            store.repairConversationProjectionActivity(actor, row, pinnedIds.contains(row.conversation().conversationId()));
            if (++attempts == MAX_DIRECTORY_REPAIRS_PER_PAGE) return;
        }
    }

    private static CanonicalCqlStore.ConversationProjectionRow preferredProjection(
            CanonicalCqlStore.ConversationProjectionRow first, CanonicalCqlStore.ConversationProjectionRow duplicate, boolean pinned) {
        boolean firstAtCurrentActivity = java.util.Objects.equals(first.lastActivityAt(), first.conversation().lastActivityAt());
        boolean duplicateAtCurrentActivity = java.util.Objects.equals(duplicate.lastActivityAt(), duplicate.conversation().lastActivityAt());
        if (firstAtCurrentActivity != duplicateAtCurrentActivity) return duplicateAtCurrentActivity ? duplicate : first;
        return duplicate.pinned() == pinned && first.pinned() != pinned ? duplicate : first;
    }

    private CanonicalApiContracts.ConversationListItem toView(
            UUID actor, CanonicalCqlStore.ConversationProjectionRow row, boolean pinned, boolean requirePreviewAuthority) {
        var member = store.findConversationMember(row.conversation().conversationId(), actor);
        if (member == null) return null;
        var last = row.lastMessage();
        int unread = last != null && ConversationUnreadPolicy.covered(last.messageId(), member.lastReadMessageId()) ? 0 : row.unreadCount();
        return new CanonicalApiContracts.ConversationListItem(row.conversation(), pinned, unread,
                member.joinedAt(), member.notificationOverride(), currentLastMessage(row, requirePreviewAuthority), peer(actor, row));
    }

    private CanonicalApiContracts.LastMessageSummary currentLastMessage(
            CanonicalCqlStore.ConversationProjectionRow row, boolean requirePreviewAuthority) {
        var last = row.lastMessage();
        if (last == null) return null;
        if (last.messageBucket() == null || last.messageBucket().isBlank()) {
            throw new IllegalStateException("conversation preview requires canonical message bucket");
        }
        var message = messages.find(row.conversation().conversationId(), last.messageBucket(), last.messageId());
        if (message == null) {
            if (requirePreviewAuthority) throw new ConflictException("conversation preview source unavailable; retry the read");
            // Keep the room and its directory cursor when the pointed-to message is missing.
            return null;
        }
        boolean deleted = Boolean.TRUE.equals(message.isDeleted());
        String content = deleted || message.content() == null ? "" : message.content();
        return new CanonicalApiContracts.LastMessageSummary(message.messageId(), message.messageBucket(), message.revision(),
                message.senderId(), last.senderDisplayName(), content.substring(0, Math.min(280, content.length())),
                message.messageType(), message.createdAt(), deleted, !deleted && Boolean.TRUE.equals(message.hasAttachments()));
    }

    private CanonicalApiContracts.ConversationPeer peer(UUID actor, CanonicalCqlStore.ConversationProjectionRow row) {
        if (!"DM".equals(row.conversation().conversationType())) return null;
        var members = store.listConversationMembers(row.conversation().conversationId(), null, 3);
        var other = members.stream().filter(member -> !actor.equals(member.userId())).findFirst().orElse(null);
        var user = other == null ? null : users.findById(other.userId());
        return user == null ? null : new CanonicalApiContracts.ConversationPeer(user.userId(), user.username(), user.displayName(), user.avatarUrl());
    }

    private CanonicalCqlStore.ConversationProjectionCursor decode(String cursor, String scope) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            if (cursor.length() > 1024) throw new IllegalArgumentException();
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (!value.startsWith(scope)) throw new IllegalArgumentException();
            String[] parts = value.substring(scope.length()).split("\\|", -1);
            if (parts.length != 3 || !Set.of("0", "1").contains(parts[0])) throw new IllegalArgumentException();
            return new CanonicalCqlStore.ConversationProjectionCursor("1".equals(parts[0]), Instant.parse(parts[1]), UUID.fromString(parts[2]));
        } catch (RuntimeException invalid) {
            throw new BadRequestException("invalid conversation cursor");
        }
    }

    private static String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String normalize(String value) {
        return value == null ? "" : Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(java.util.Locale.ROOT).replace('đ', 'd').trim();
    }
}
