package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.service.ConversationMembershipService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class InviteService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final CanonicalCqlStore store;
    private final InviteRepository invites;
    private final ConversationAuthorizationService authorization;
    private final ConversationMembershipService memberships;
    private final CanonicalEventRecorder events;
    private final String publicBaseUrl;

    public InviteService(
            CanonicalCqlStore store,
            InviteRepository invites,
            ConversationAuthorizationService authorization,
            ConversationMembershipService memberships,
            CanonicalEventRecorder events,
            @Value("${app.public-base-url:http://localhost:5173}") String publicBaseUrl) {
        this.store = store;
        this.invites = invites;
        this.authorization = authorization;
        this.memberships = memberships;
        this.events = events;
        this.publicBaseUrl = publicBaseUrl;
    }

    public CanonicalApiContracts.InviteLinkView create(
            UUID actorId, CanonicalApiContracts.InviteLinkCreateRequest request) {
        authorization.requirePermission(request.conversationId(), actorId, ConversationPermission.INVITE_MANAGE);
        String inviteKind = normalize(request.inviteKind(), "LINK").toUpperCase(Locale.ROOT);
        String joinPolicy = normalize(request.joinPolicy(), "DIRECT_JOIN").toUpperCase(Locale.ROOT);
        if (!Set.of("LINK", "QR").contains(inviteKind)) {
            throw new BadRequestException("inviteKind must be LINK or QR");
        }
        if (!Set.of("DIRECT_JOIN", "REQUEST_APPROVAL").contains(joinPolicy)) {
            throw new BadRequestException("joinPolicy must be DIRECT_JOIN or REQUEST_APPROVAL");
        }
        if (request.maxUses() != null && (request.maxUses() < 1 || request.maxUses() > 1_000_000)) {
            throw new BadRequestException("maxUses must be between 1 and 1000000");
        }
        Instant expiresAt = expiration(request);
        UUID linkId = com.datastax.oss.driver.api.core.uuid.Uuids.timeBased();
        String token = createToken();
        CanonicalInviteLink invite = new CqlCanonicalRecords.CanonicalInviteLink(
                linkId, token, request.conversationId(), actorId, Instant.now(), inviteKind, joinPolicy,
                normalize(request.displayName(), "invite"), expiresAt, true, request.maxUses(), 0, null, null);
        invites.create(invite);
        audit(actorId, request.conversationId(), "INVITE_CREATE", "invite", linkId.toString(), null, null);
        return new CanonicalApiContracts.InviteLinkView(invite, joinUrl(token));
    }

    public InviteRepository.InvitePage list(UUID actorId, UUID conversationId, UUID before, int limit) {
        authorization.requirePermission(conversationId, actorId, ConversationPermission.INVITE_MANAGE);
        return invites.listByConversation(conversationId, before, Math.max(1, Math.min(50, limit)));
    }

    public CanonicalApiContracts.InvitePreview preview(String token) {
        CanonicalInviteLink invite = invites.findByToken(token);
        if (invite == null) {
            return new CanonicalApiContracts.InvitePreview(
                    "INVALID", null, null, null, null, null, null, null, null);
        }
        CanonicalConversation conversation = store.findConversation(invite.conversationId());
        int used = invite.usedCount() == null ? 0 : invite.usedCount();
        Integer remaining = invite.maxUses() == null ? null : Math.max(0, invite.maxUses() - used);
        return new CanonicalApiContracts.InvitePreview(
                InvitePolicy.status(invite, conversation, used), invite.conversationId(),
                conversation == null ? null : conversation.name(),
                conversation == null ? null : conversation.conversationType(), invite.createdBy(),
                invite.displayName(), invite.joinPolicy(), invite.expiresAt(), remaining);
    }

    public CanonicalApiContracts.InviteConsumeResponse consume(
            UUID actorId, CanonicalApiContracts.InviteConsumeRequest request) {
        CanonicalInviteLink invite = invites.findByToken(request.linkToken());
        if (invite == null) {
            return new CanonicalApiContracts.InviteConsumeResponse("INVALID", null);
        }
        if (memberships.isBanned(invite.conversationId(), actorId)) {
            return new CanonicalApiContracts.InviteConsumeResponse("BANNED", invite.conversationId());
        }
        CanonicalConversationMember existing = store.findConversationMember(invite.conversationId(), actorId);
        if (existing != null) {
            memberships.repairProjections(existing);
            invites.recordOutcome(invite, actorId, "ALREADY_MEMBER");
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_MEMBER", invite.conversationId());
        }
        String priorStatus = invites.findViewerStatus(invite, actorId);
        boolean hasReservedUse = "DIRECT_JOIN".equals(invite.joinPolicy()) && "ACCEPTED".equals(priorStatus);
        CanonicalConversation conversation = store.findConversation(invite.conversationId());
        String conversationStatus = InvitePolicy.status(
                invite, conversation, invite.usedCount() == null ? 0 : invite.usedCount());
        if (conversation == null || Boolean.TRUE.equals(conversation.isDeleted())) {
            invites.recordOutcome(invite, actorId, conversationStatus);
            return new CanonicalApiContracts.InviteConsumeResponse(conversationStatus, invite.conversationId());
        }
        String status = InvitePolicy.status(invite, invite.usedCount() == null ? 0 : invite.usedCount());
        if (!"ACTIVE".equals(status) && !hasReservedUse) {
            invites.recordOutcome(invite, actorId, status);
            return new CanonicalApiContracts.InviteConsumeResponse(status, invite.conversationId());
        }
        if ("REQUEST_APPROVAL".equals(invite.joinPolicy())) {
            String requestStatus = invites.requestApproval(invite, actorId);
            audit(actorId, invite.conversationId(), "JOIN_REQUEST_CREATE", "invite",
                    invite.linkId().toString(), null, null);
            return new CanonicalApiContracts.InviteConsumeResponse(
                    "ACCEPTED".equals(requestStatus) ? "PENDING" : requestStatus, invite.conversationId());
        }
        CanonicalCqlStore.MembershipState state = store.requireMembershipState(invite.conversationId());
        if (state.memberCount() >= state.maxMembers()) {
            if (hasReservedUse) {
                invites.releaseUse(invite, actorId);
            }
            return new CanonicalApiContracts.InviteConsumeResponse("CAPACITY_REACHED", invite.conversationId());
        }
        InviteRepository.ConsumeResult result = hasReservedUse
                ? InviteRepository.ConsumeResult.ALREADY_ACCEPTED
                : invites.consume(request.linkToken(), actorId);
        boolean reservedNow = result == InviteRepository.ConsumeResult.CONSUMED;
        if (!reservedNow && result != InviteRepository.ConsumeResult.ALREADY_ACCEPTED) {
            return new CanonicalApiContracts.InviteConsumeResponse("RETRY_REQUIRED", invite.conversationId());
        }
        CanonicalConversationMember member = new CqlCanonicalRecords.CanonicalConversationMember(
                invite.conversationId(), actorId, memberships.defaultRoleIds(invite.conversationId()),
                Instant.now(), invite.createdBy(), null, null, "INHERIT", null, Instant.now());
        ConversationMembershipService.MembershipClaimResult membershipResult = memberships.claim(member);
        if (membershipResult == ConversationMembershipService.MembershipClaimResult.BANNED) {
            if (reservedNow || hasReservedUse) invites.releaseUse(invite, actorId);
            return new CanonicalApiContracts.InviteConsumeResponse("BANNED", invite.conversationId());
        }
        if (membershipResult == ConversationMembershipService.MembershipClaimResult.CAPACITY_REACHED) {
            invites.releaseUse(invite, actorId);
            return new CanonicalApiContracts.InviteConsumeResponse("CAPACITY_REACHED", invite.conversationId());
        }
        if (membershipResult == ConversationMembershipService.MembershipClaimResult.ALREADY_MEMBER) {
            if (reservedNow) {
                invites.releaseUse(invite, actorId);
            }
            CanonicalConversationMember current = store.findConversationMember(invite.conversationId(), actorId);
            if (current == null) {
                throw new IllegalStateException("conversation member is missing after membership claim");
            }
            memberships.repairProjections(current);
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_MEMBER", invite.conversationId());
        }
        memberships.repairProjections(member);
        audit(actorId, invite.conversationId(), "JOIN_BY_INVITE", "conversation",
                invite.conversationId().toString(), null, null);
        return new CanonicalApiContracts.InviteConsumeResponse("ACCEPTED", invite.conversationId());
    }

    public CanonicalApiContracts.InviteViewerState viewerState(UUID actorId, String token) {
        CanonicalInviteLink invite = invites.findByToken(token);
        if (invite == null) {
            return new CanonicalApiContracts.InviteViewerState("INVALID", null);
        }
        if (memberships.isBanned(invite.conversationId(), actorId)) {
            return new CanonicalApiContracts.InviteViewerState("BANNED", invite.conversationId());
        }
        if (store.findConversationMember(invite.conversationId(), actorId) != null) {
            return new CanonicalApiContracts.InviteViewerState("ALREADY_MEMBER", invite.conversationId());
        }
        CanonicalConversation conversation = store.findConversation(invite.conversationId());
        if (conversation == null || Boolean.TRUE.equals(conversation.isDeleted())) {
            return new CanonicalApiContracts.InviteViewerState("FAILED", invite.conversationId());
        }
        String status = invites.findViewerStatus(invite, actorId);
        if (status == null) {
            return new CanonicalApiContracts.InviteViewerState("AVAILABLE", invite.conversationId());
        }
        if (!Set.of("PENDING", "ACCEPTED", "DECLINED", "FAILED").contains(status)) {
            throw new IllegalStateException("unsupported invite viewer status: " + status);
        }
        if ("ACCEPTED".equals(status)) {
            return new CanonicalApiContracts.InviteViewerState(
                    "REQUEST_APPROVAL".equals(invite.joinPolicy()) ? "PENDING" : "FAILED",
                    invite.conversationId());
        }
        return new CanonicalApiContracts.InviteViewerState(status, invite.conversationId());
    }

    public void revoke(UUID actorId, String token) {
        CanonicalInviteLink invite = invites.findByToken(token);
        if (invite == null) {
            throw new NotFoundException("invite not found");
        }
        authorization.requirePermission(invite.conversationId(), actorId, ConversationPermission.INVITE_MANAGE);
        invites.revoke(invite, actorId);
        audit(actorId, invite.conversationId(), "INVITE_REVOKE", "invite", invite.linkId().toString(), null, null);
    }

    public CanonicalApiContracts.InviteConsumeResponse decline(UUID actorId, String token) {
        CanonicalInviteLink invite = invites.findByToken(token);
        if (invite == null) {
            return new CanonicalApiContracts.InviteConsumeResponse("INVALID", null);
        }
        if (!invites.decline(invite, actorId)) {
            return new CanonicalApiContracts.InviteConsumeResponse("ALREADY_ACCEPTED", invite.conversationId());
        }
        audit(actorId, invite.conversationId(), "INVITE_DECLINE", "invite", invite.linkId().toString(), null, null);
        return new CanonicalApiContracts.InviteConsumeResponse("DECLINED", invite.conversationId());
    }

    private Instant expiration(CanonicalApiContracts.InviteLinkCreateRequest request) {
        Instant expiresAt = request.expiresAt();
        if (expiresAt == null && request.durationMinutes() != null) {
            if (request.durationMinutes() < 1 || request.durationMinutes() > 525_600) {
                throw new BadRequestException("durationMinutes must be between 1 and 525600");
            }
            expiresAt = Instant.now().plusSeconds(request.durationMinutes() * 60L);
        }
        if (expiresAt == null) {
            expiresAt = Instant.now().plusSeconds(7 * 24 * 3600L);
        }
        if (!expiresAt.isAfter(Instant.now())) {
            throw new BadRequestException("invite expiration must be in the future");
        }
        return expiresAt;
    }

    private void audit(
            UUID actorId, UUID conversationId, String action, String resourceType,
            String resourceId, UUID targetUserId, String reason) {
        events.record(actorId, conversationId, action, resourceType, resourceId,
                targetUserId, reason, Map.of(), Map.of());
    }

    private String normalize(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String createToken() {
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    private String joinUrl(String token) {
        return publicBaseUrl.replaceAll("/+$", "") + "/join/" + token;
    }
}
