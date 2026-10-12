package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.service.ConversationMembershipService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class JoinRequestService {
    private final CanonicalCqlStore store;
    private final InviteRepository invites;
    private final ConversationAuthorizationService authorization;
    private final ConversationMembershipService memberships;
    private final CanonicalEventRecorder events;
    private final NotificationService notifications;

    public JoinRequestService(
            CanonicalCqlStore store,
            InviteRepository invites,
            ConversationAuthorizationService authorization,
            ConversationMembershipService memberships,
            CanonicalEventRecorder events,
            NotificationService notifications) {
        this.store = store;
        this.invites = invites;
        this.authorization = authorization;
        this.memberships = memberships;
        this.events = events;
        this.notifications = notifications;
    }

    public JoinRequestPage list(UUID actorId, UUID conversationId, UUID before, int limit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        if (before != null && before.version() != 1) {
            throw new BadRequestException("before must be a timeuuid");
        }
        int boundedLimit = Math.max(1, Math.min(100, limit));
        List<CanonicalApiContracts.JoinRequestView> requests = new ArrayList<>();
        requests.addAll(invites.listRequests(conversationId, before, boundedLimit + 1));
        requests.addAll(store.listCommunityJoinRequests(conversationId, before, boundedLimit + 1));
        List<CanonicalApiContracts.JoinRequestView> merged = requests.stream()
                .sorted((left, right) -> compareRequestTime(right.requestedAt(), left.requestedAt()))
                .toList();
        boolean hasNext = merged.size() > boundedLimit;
        List<CanonicalApiContracts.JoinRequestView> content = merged.subList(
                0, Math.min(boundedLimit, merged.size()));
        UUID nextCursor = hasNext && !content.isEmpty()
                ? content.get(content.size() - 1).requestedAt() : null;
        return new JoinRequestPage(content, nextCursor, hasNext);
    }

    private static int compareRequestTime(UUID left, UUID right) {
        int timestampOrder = Long.compare(left.timestamp(), right.timestamp());
        if (timestampOrder != 0) return timestampOrder;
        // Cassandra timeuuid orders equal timestamps by signed bytes, not UUID.compareTo.
        for (int shift = 56; shift >= 0; shift -= 8) {
            int byteOrder = Byte.compare((byte) (left.getLeastSignificantBits() >>> shift),
                    (byte) (right.getLeastSignificantBits() >>> shift));
            if (byteOrder != 0) return byteOrder;
        }
        return 0;
    }

    public CanonicalApiContracts.JoinRequestView resolve(
            UUID actorId,
            UUID conversationId,
            UUID requestId,
            CanonicalApiContracts.JoinRequestDecisionRequest request) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        validateDecision(request);
        String decision = request.decision().trim().toUpperCase(Locale.ROOT);
        InviteRepository.InviteJoinRequest row = invites.findRequest(
                conversationId, request.requestedAt(), requestId);
        if (row == null) {
            return resolveCommunity(actorId, conversationId, requestId, request, decision);
        }
        if (!Set.of("PENDING", "APPROVING").contains(row.status())) {
            throw new ConflictException("join request is no longer pending");
        }
        if (!invites.claimResolution(
                conversationId, request.requestedAt(), requestId, actorId, decision)) {
            throw new ConflictException("join request is being handled by another manager");
        }
        UUID userId = row.userId();
        CanonicalInviteLink invite = invites.findByToken(row.linkToken());
        if ("DECLINE".equals(decision)) {
            if (invite != null) {
                invites.decline(invite, userId);
            }
            notifications.notifyJoinRequestResolved(
                    userId, request.requestedAt(), conversationId, actorId, false);
            invites.finishResolution(
                    conversationId, request.requestedAt(), requestId, "DECLINED", actorId);
            audit(actorId, conversationId, "JOIN_REQUEST_DECLINE", "join_request",
                    requestId, userId, request.reason());
            return resolved(conversationId, request.requestedAt(), requestId);
        }
        if (memberships.isBanned(conversationId, userId)) {
            invites.finishResolution(conversationId, request.requestedAt(), requestId, "FAILED", actorId);
            throw new ConflictException("banned users cannot join this conversation");
        }
        CanonicalConversation conversation = memberships.requireConversation(conversationId);
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            invites.finishResolution(
                    conversationId, request.requestedAt(), requestId, "FAILED", actorId);
            throw new ConflictException("archived conversations do not accept new members");
        }
        boolean inviteMatches = invite != null && invite.linkId().equals(row.linkId());
        boolean accepted = inviteMatches && "ACCEPTED".equals(invites.findViewerStatus(invite, userId));
        if (!inviteMatches || (!accepted
                && !"ACTIVE".equals(InvitePolicy.status(invite, invite.usedCount() == null ? 0 : invite.usedCount())))) {
            if (inviteMatches) {
                invites.markFailed(invite, userId);
            }
            invites.finishResolution(
                    conversationId, request.requestedAt(), requestId, "FAILED", actorId);
            throw new ConflictException("invite is no longer usable");
        }
        CanonicalConversationMember existing = store.findConversationMember(conversationId, userId);
        if (existing == null) {
            CanonicalCqlStore.MembershipState state = store.requireMembershipState(conversationId);
            if (state.memberCount() >= state.maxMembers()) {
                failForCapacity(invite, userId, accepted, conversationId, request.requestedAt(), requestId, actorId);
            }
            if (!accepted && !invites.reserveUse(invite, userId)) {
                invites.markFailed(invite, userId);
                invites.finishResolution(
                        conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("invite usage changed concurrently; retry with a new invite");
            }
            accepted = true;
            CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                    conversationId, userId, memberships.defaultRoleIds(conversationId), Instant.now(), actorId,
                    null, null, "INHERIT", null, Instant.now());
            ConversationMembershipService.MembershipClaimResult result = memberships.claim(member);
            if (result == ConversationMembershipService.MembershipClaimResult.BANNED) {
                invites.releaseUse(invite, userId);
                invites.finishResolution(conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("banned users cannot join this conversation");
            }
            if (result == ConversationMembershipService.MembershipClaimResult.CAPACITY_REACHED) {
                invites.releaseUse(invite, userId);
                invites.finishResolution(
                        conversationId, request.requestedAt(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            if (result == ConversationMembershipService.MembershipClaimResult.ALREADY_MEMBER) {
                invites.releaseUse(invite, userId);
            }
            CanonicalConversationMember current = result == ConversationMembershipService.MembershipClaimResult.ADDED
                    ? member : store.findConversationMember(conversationId, userId);
            if (current == null) {
                throw new IllegalStateException("conversation member is missing after membership claim");
            }
            memberships.repairProjections(current);
        } else {
            memberships.repairProjections(existing);
        }
        notifications.notifyJoinRequestResolved(
                userId, request.requestedAt(), conversationId, actorId, true);
        invites.finishResolution(
                conversationId, request.requestedAt(), requestId, "APPROVED", actorId);
        audit(actorId, conversationId, "JOIN_REQUEST_APPROVE", "join_request",
                requestId, userId, request.reason());
        return resolved(conversationId, request.requestedAt(), requestId);
    }

    private CanonicalApiContracts.JoinRequestView resolveCommunity(
            UUID actorId,
            UUID conversationId,
            UUID requestId,
            CanonicalApiContracts.JoinRequestDecisionRequest request,
            String decision) {
        if (request.userId() == null) {
            throw new NotFoundException("join request not found");
        }
        CanonicalCqlStore.CommunityJoinRequestRow joinRequest =
                store.findCommunityJoinRequest(conversationId, request.userId());
        if (joinRequest == null || !requestId.equals(joinRequest.requestId())
                || !request.requestedAt().equals(joinRequest.requestedAt())) {
            throw new NotFoundException("join request not found");
        }
        if (!Set.of("PENDING", "APPROVING").contains(joinRequest.status())) {
            throw new ConflictException("join request is no longer pending");
        }
        if (!store.claimCommunityJoinResolution(
                conversationId, request.userId(), requestId, actorId, decision)) {
            throw new ConflictException("join request is being handled by another manager");
        }
        if ("DECLINE".equals(decision)) {
            notifications.notifyJoinRequestResolved(
                    request.userId(), request.requestedAt(), conversationId, actorId, false);
            store.finishCommunityJoinResolution(
                    conversationId, request.userId(), requestId, "DECLINED", actorId);
            audit(actorId, conversationId, "JOIN_REQUEST_DECLINE", "community_join_request",
                    requestId, request.userId(), request.reason());
            return store.findCommunityJoinRequest(conversationId, request.userId()).toView();
        }
        if (memberships.isBanned(conversationId, request.userId())) {
            store.finishCommunityJoinResolution(
                    conversationId, request.userId(), requestId, "FAILED", actorId);
            throw new ConflictException("banned users cannot join this conversation");
        }
        CanonicalConversation conversation = memberships.requireConversation(conversationId);
        if (!"COMMUNITY".equals(conversation.visibility()) || Boolean.TRUE.equals(conversation.isDeleted())) {
            store.finishCommunityJoinResolution(
                    conversationId, request.userId(), requestId, "FAILED", actorId);
            throw new ConflictException("community is no longer accepting requests");
        }
        CanonicalConversationMember existing = store.findConversationMember(conversationId, request.userId());
        if (existing == null) {
            CanonicalCqlStore.MembershipState state = store.requireMembershipState(conversationId);
            if (state.memberCount() >= state.maxMembers()) {
                store.finishCommunityJoinResolution(
                        conversationId, request.userId(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                    conversationId, request.userId(), memberships.defaultRoleIds(conversationId),
                    Instant.now(), actorId, null, null, "INHERIT", null, Instant.now());
            ConversationMembershipService.MembershipClaimResult result = memberships.claim(member);
            if (result == ConversationMembershipService.MembershipClaimResult.BANNED) {
                store.finishCommunityJoinResolution(
                        conversationId, request.userId(), requestId, "FAILED", actorId);
                throw new ConflictException("banned users cannot join this conversation");
            }
            if (result == ConversationMembershipService.MembershipClaimResult.CAPACITY_REACHED) {
                store.finishCommunityJoinResolution(
                        conversationId, request.userId(), requestId, "FAILED", actorId);
                throw new ConflictException("conversation capacity has been reached");
            }
            CanonicalConversationMember current = result == ConversationMembershipService.MembershipClaimResult.ADDED
                    ? member : store.findConversationMember(conversationId, request.userId());
            if (current == null) {
                throw new IllegalStateException("conversation member is missing after membership claim");
            }
            memberships.repairProjections(current);
        } else {
            memberships.repairProjections(existing);
        }
        notifications.notifyJoinRequestResolved(
                request.userId(), request.requestedAt(), conversationId, actorId, true);
        store.finishCommunityJoinResolution(
                conversationId, request.userId(), requestId, "APPROVED", actorId);
        audit(actorId, conversationId, "JOIN_REQUEST_APPROVE", "community_join_request",
                requestId, request.userId(), request.reason());
        return store.findCommunityJoinRequest(conversationId, request.userId()).toView();
    }

    private void validateDecision(CanonicalApiContracts.JoinRequestDecisionRequest request) {
        if (request.requestedAt() == null) {
            throw new BadRequestException("requestedAt is required");
        }
        if (!StringUtils.hasText(request.decision())) {
            throw new BadRequestException("decision is required");
        }
        String decision = request.decision().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVE", "DECLINE").contains(decision)) {
            throw new BadRequestException("decision must be APPROVE or DECLINE");
        }
    }

    private void failForCapacity(
            CanonicalInviteLink invite,
            UUID userId,
            boolean accepted,
            UUID conversationId,
            UUID requestedAt,
            UUID requestId,
            UUID actorId) {
        if (accepted) {
            invites.releaseUse(invite, userId);
        } else {
            invites.markFailed(invite, userId);
        }
        invites.finishResolution(conversationId, requestedAt, requestId, "FAILED", actorId);
        throw new ConflictException("conversation capacity has been reached");
    }

    private CanonicalApiContracts.JoinRequestView resolved(
            UUID conversationId, UUID requestedAt, UUID requestId) {
        InviteRepository.InviteJoinRequest row = invites.findRequest(conversationId, requestedAt, requestId);
        if (row == null) {
            throw new NotFoundException("join request not found");
        }
        return new CanonicalApiContracts.JoinRequestView(
                conversationId, requestedAt, requestId, row.userId(),
                row.linkId(), row.status(), row.resolvedBy(), row.resolvedAt());
    }

    private void audit(
            UUID actorId,
            UUID conversationId,
            String action,
            String resourceType,
            UUID resourceId,
            UUID targetUserId,
            String reason) {
        events.record(actorId, conversationId, action, resourceType, resourceId.toString(),
                targetUserId, reason, Map.of(), Map.of());
    }

    public record JoinRequestPage(
            List<CanonicalApiContracts.JoinRequestView> content,
            UUID nextCursor,
            boolean hasNext) {
    }
}
