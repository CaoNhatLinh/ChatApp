package com.chatapp.chat_service.canonical.community;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationMembershipService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class CommunityService {
    private final CanonicalCqlStore store;
    private final ConversationMembershipService memberships;
    private final CanonicalEventRecorder events;

    public CommunityService(
            CanonicalCqlStore store,
            ConversationMembershipService memberships,
            CanonicalEventRecorder events) {
        this.store = store;
        this.memberships = memberships;
        this.events = events;
    }

    public CanonicalApiContracts.CommunityPage list(
            UUID actorId,
            String languageCode,
            String categoryId,
            String tag,
            String query,
            String cursor,
            int requestedLimit) {
        requireUser(actorId);
        if (StringUtils.hasText(categoryId) && StringUtils.hasText(tag)) {
            throw new BadRequestException("categoryId and tag cannot be combined");
        }
        int limit = Math.max(1, Math.min(50, requestedLimit));
        String filter = CommunityDirectoryFilter.selected(normalize(languageCode, "vi"), categoryId, tag);
        String namePrefix = normalize(query);
        CommunityCursor after = decodeCursor(cursor);
        if (after != null && (!filter.equals(after.discoveryFilter()) || !namePrefix.equals(after.namePrefix()))) {
            throw new BadRequestException("community cursor does not match the active filters");
        }
        List<CanonicalCqlStore.CommunityDirectoryKey> keys = store.listCommunityDirectory(
                filter,
                namePrefix,
                after == null ? null : after.nameNormalized(),
                after == null ? null : after.conversationId(),
                limit + 1);
        boolean hasNext = keys.size() > limit;
        List<CanonicalCqlStore.CommunityDirectoryKey> pageKeys = keys.stream().limit(limit).toList();
        List<CanonicalApiContracts.CommunitySummary> content = new ArrayList<>(pageKeys.size());
        for (CanonicalCqlStore.CommunityDirectoryKey key : pageKeys) {
            CanonicalConversation conversation = store.findConversation(key.conversationId());
            if (conversation == null || Boolean.TRUE.equals(conversation.isDeleted())
                    || !"COMMUNITY".equals(conversation.visibility())) {
                continue;
            }
            boolean banned = memberships.isBanned(conversation.conversationId(), actorId);
            boolean joined = !banned && store.findConversationMember(conversation.conversationId(), actorId) != null;
            String status = banned ? "BANNED" : joined ? "JOINED" : publicMembershipStatus(
                    store.findCommunityJoinStatus(conversation.conversationId(), actorId));
            content.add(new CanonicalApiContracts.CommunitySummary(
                    conversation.conversationId(), conversation.name(), conversation.description(),
                    conversation.avatarUrl(), conversation.categoryId(), conversation.communityTags(),
                    conversation.languageCode(), conversation.joinPolicy(), conversation.memberCount(),
                    conversation.maxMembers(), conversation.lastActivityAt(), status));
        }
        String nextCursor = hasNext && !pageKeys.isEmpty()
                ? encodeCursor(filter, namePrefix, pageKeys.get(pageKeys.size() - 1))
                : null;
        return new CanonicalApiContracts.CommunityPage(content, nextCursor, hasNext);
    }

    public CanonicalApiContracts.CommunityJoinResponse join(UUID actorId, UUID conversationId) {
        requireUser(actorId);
        CanonicalConversation conversation = memberships.requireConversation(conversationId);
        if (!"COMMUNITY".equals(conversation.visibility())) {
            throw new BadRequestException("conversation is not a public community");
        }
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            throw new ConflictException("archived communities cannot accept members");
        }
        if (memberships.isBanned(conversationId, actorId)) {
            return new CanonicalApiContracts.CommunityJoinResponse("BANNED", conversationId);
        }
        CanonicalConversationMember existing = store.findConversationMember(conversationId, actorId);
        if (existing != null) {
            memberships.repairProjections(existing);
            return new CanonicalApiContracts.CommunityJoinResponse("JOINED", conversationId);
        }
        if ("REQUEST_APPROVAL".equals(conversation.joinPolicy())) {
            CanonicalCqlStore.CommunityJoinClaim claim = store.requestCommunityApproval(conversationId, actorId);
            if (claim.created()) {
                audit(actorId, conversationId, "COMMUNITY_JOIN_REQUEST");
            }
            String status = switch (claim.status()) {
                case "PENDING", "APPROVING" -> "PENDING";
                case "RETRY_REQUIRED" -> "RETRY_REQUIRED";
                default -> throw new IllegalStateException("unsupported community join claim status: " + claim.status());
            };
            return new CanonicalApiContracts.CommunityJoinResponse(status, conversationId);
        }
        if (!"DIRECT_JOIN".equals(conversation.joinPolicy())) {
            throw new ConflictException("community is not accepting public joins");
        }
        CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                conversationId, actorId, memberships.defaultRoleIds(conversationId), Instant.now(), null,
                null, null, "INHERIT", null, Instant.now());
        ConversationMembershipService.MembershipClaimResult result = memberships.claim(member);
        if (result == ConversationMembershipService.MembershipClaimResult.BANNED) {
            return new CanonicalApiContracts.CommunityJoinResponse("BANNED", conversationId);
        }
        if (result == ConversationMembershipService.MembershipClaimResult.CAPACITY_REACHED) {
            return new CanonicalApiContracts.CommunityJoinResponse("CAPACITY_REACHED", conversationId);
        }
        CanonicalConversationMember current = result == ConversationMembershipService.MembershipClaimResult.ADDED
                ? member : store.findConversationMember(conversationId, actorId);
        if (current == null) {
            throw new IllegalStateException("conversation member is missing after membership claim");
        }
        memberships.repairProjections(current);
        if (result == ConversationMembershipService.MembershipClaimResult.ADDED) {
            audit(actorId, conversationId, "COMMUNITY_JOIN");
        }
        return new CanonicalApiContracts.CommunityJoinResponse("JOINED", conversationId);
    }

    private void audit(UUID actorId, UUID conversationId, String action) {
        events.record(actorId, conversationId, action, "conversation", conversationId.toString(),
                actorId, null, java.util.Map.of(), java.util.Map.of());
    }

    private String publicMembershipStatus(String storedStatus) {
        if (storedStatus == null || Set.of("DECLINED", "FAILED", "APPROVED").contains(storedStatus)) {
            return "AVAILABLE";
        }
        if (Set.of("PENDING", "APPROVING").contains(storedStatus)) {
            return "PENDING";
        }
        throw new IllegalStateException("unsupported community membership status: " + storedStatus);
    }

    private String encodeCursor(String filter, String prefix, CanonicalCqlStore.CommunityDirectoryKey key) {
        byte[] filterBytes = filter.getBytes(StandardCharsets.UTF_8);
        byte[] prefixBytes = prefix.getBytes(StandardCharsets.UTF_8);
        byte[] nameBytes = key.nameNormalized().getBytes(StandardCharsets.UTF_8);
        ByteBuffer buffer = ByteBuffer.allocate(
                Integer.BYTES * 3 + filterBytes.length + prefixBytes.length + nameBytes.length + Long.BYTES * 2);
        putString(buffer, filterBytes);
        putString(buffer, prefixBytes);
        putString(buffer, nameBytes);
        buffer.putLong(key.conversationId().getMostSignificantBits());
        buffer.putLong(key.conversationId().getLeastSignificantBits());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.array());
    }

    private void putString(ByteBuffer buffer, byte[] value) {
        buffer.putInt(value.length);
        buffer.put(value);
    }

    private CommunityCursor decodeCursor(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor);
            if (decoded.length > 8192) {
                throw new IllegalArgumentException("cursor is too large");
            }
            ByteBuffer buffer = ByteBuffer.wrap(decoded);
            String filter = readString(buffer);
            String prefix = readString(buffer);
            String name = readString(buffer);
            UUID conversationId = new UUID(buffer.getLong(), buffer.getLong());
            if (buffer.hasRemaining()) {
                throw new IllegalArgumentException("unexpected cursor data");
            }
            return new CommunityCursor(filter, prefix, name, conversationId);
        } catch (IllegalArgumentException | java.nio.BufferUnderflowException exception) {
            throw new BadRequestException("community cursor is invalid");
        }
    }

    private String readString(ByteBuffer buffer) {
        int length = buffer.getInt();
        if (length < 0 || length > buffer.remaining() - Long.BYTES * 2) {
            throw new IllegalArgumentException("invalid cursor string length");
        }
        byte[] value = new byte[length];
        buffer.get(value);
        return new String(value, StandardCharsets.UTF_8);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(java.util.Locale.ROOT) : "";
    }

    private String normalize(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private void requireUser(UUID userId) {
        if (userId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    private record CommunityCursor(String discoveryFilter, String namePrefix, String nameNormalized, UUID conversationId) {
    }
}
