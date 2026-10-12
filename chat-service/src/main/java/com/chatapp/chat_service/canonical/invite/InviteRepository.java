package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface InviteRepository {
    void create(CanonicalInviteLink invite);

    InvitePage listByConversation(UUID conversationId, UUID before, int limit);

    CanonicalInviteLink findByToken(String token);

    String findViewerStatus(CanonicalInviteLink invite, UUID userId);

    ConsumeResult consume(String token, UUID userId);

    String requestApproval(CanonicalInviteLink invite, UUID userId);

    void recordOutcome(CanonicalInviteLink invite, UUID userId, String outcome);

    boolean decline(CanonicalInviteLink invite, UUID userId);

    List<CanonicalApiContracts.JoinRequestView> listRequests(UUID conversationId, UUID before, int limit);

    InviteJoinRequest findRequest(UUID conversationId, UUID requestedAt, UUID requestId);

    boolean claimResolution(
            UUID conversationId, UUID requestedAt, UUID requestId, UUID actorId, String decision);

    void finishResolution(
            UUID conversationId, UUID requestedAt, UUID requestId, String status, UUID actorId);

    boolean reserveUse(CanonicalInviteLink invite, UUID userId);

    void releaseUse(CanonicalInviteLink invite, UUID userId);

    void markFailed(CanonicalInviteLink invite, UUID userId);

    void revoke(CanonicalInviteLink invite, UUID actorId);

    enum ConsumeResult {
        CONSUMED,
        ALREADY_ACCEPTED,
        RETRY_REQUIRED
    }

    record InvitePage(List<CanonicalInviteLink> content, UUID nextCursor, boolean hasNext) {
    }

    record InviteJoinRequest(
            String status,
            String resolutionDecision,
            UUID resolvedBy,
            UUID userId,
            UUID linkId,
            String linkToken,
            Instant resolvedAt) {
    }
}
