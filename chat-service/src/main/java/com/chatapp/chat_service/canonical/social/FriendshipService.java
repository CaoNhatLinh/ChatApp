package com.chatapp.chat_service.canonical.social;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.FriendRequestNotificationService;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FriendshipService {
    private final CanonicalEventRecorder eventRecorder;
    private final CanonicalCqlStore cqlStore;
    private final FriendshipRepository repository;
    private final FriendRequestNotificationService friendRequestNotificationService;

    public FriendshipService(
            CanonicalEventRecorder eventRecorder,
            CanonicalCqlStore cqlStore,
            FriendshipRepository repository,
            FriendRequestNotificationService friendRequestNotificationService) {
        this.eventRecorder = eventRecorder;
        this.cqlStore = cqlStore;
        this.repository = repository;
        this.friendRequestNotificationService = friendRequestNotificationService;
    }

    public CanonicalApiContracts.FriendshipStatusResponse sendFriendRequest(
            UUID actorId,
            UUID recipientId,
            String message) {
        if (actorId.equals(recipientId)) {
            throw new BadRequestException("cannot send request to self");
        }
        CanonicalUser actor = cqlStore.findUserById(actorId);
        if (actor == null || !"ACTIVE".equalsIgnoreCase(actor.accountStatus())) {
            throw new NotFoundException("actor not found");
        }
        CanonicalUser recipient = cqlStore.findUserById(recipientId);
        if (recipient == null || !"ACTIVE".equalsIgnoreCase(recipient.accountStatus())) {
            throw new NotFoundException("recipient not found");
        }
        if (repository.isBlocked(actorId, recipientId) || repository.isBlockedBy(actorId, recipientId)) {
            throw new ForbiddenException("cannot send request due block");
        }

        var reverseRequest = repository.findRequest(recipientId, actorId);
        if (reverseRequest != null && "PENDING".equals(reverseRequest.status())) {
            acceptRequestInternal(actorId, recipientId, reverseRequest);
            return listStatus(actorId, "ACCEPTED", 50);
        }

        var pairState = repository.findFriendshipPair(actorId, recipientId);
        if (pairState != null && "ACCEPTED".equals(pairState.status())) {
            throw new ConflictException("already friends");
        }

        UUID requestId = Uuids.timeBased();
        var existing = repository.findRequest(actorId, recipientId);
        if (existing != null) {
            if ("PENDING".equals(existing.status())) {
                throw new ConflictException("friend request already pending");
            }
            if ("ACCEPTED".equals(existing.status())) {
                throw new ConflictException("already processed as accepted request");
            }
            if (!repository.resetRequestToPending(actorId, recipientId, requestId, message)) {
                throw new ConflictException("request is changing too quickly");
            }
            if (existing.requestedAt() != null) {
                repository.deleteRequestInbox(recipientId, existing.requestedAt(), actorId);
            }
        } else if (!repository.claimRequest(actorId, recipientId, requestId, message)) {
            var retry = repository.findRequest(actorId, recipientId);
            if (retry != null && "PENDING".equals(retry.status())) {
                throw new ConflictException("friend request already pending");
            }
            if (retry != null && "ACCEPTED".equals(retry.status())) {
                throw new ConflictException("already friends");
            }
        }

        var finalRequest = repository.findRequest(actorId, recipientId);
        if (finalRequest == null || !"PENDING".equals(finalRequest.status())) {
            throw new ConflictException("unable to create friend request");
        }

        repository.saveRequestInbox(recipientId, finalRequest.requestedAt(), actorId, finalRequest.message());
        repository.upsertFriendshipProjection(
                actorId,
                recipientId,
                "PENDING_OUTGOING",
                Uuids.timeBased(),
                timeuuidToInstant(finalRequest.requestedAt()),
                null);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_REQUEST_SEND",
                "friendship",
                recipientId.toString(),
                recipientId,
                null,
                Map.of(),
                Map.of());
        friendRequestNotificationService.sendFriendRequestSent(recipientId, actorId, finalRequest.requestedAt());
        return listStatus(actorId, "PENDING", 50);
    }

    public CanonicalApiContracts.FriendshipStatusResponse acceptRequest(
            UUID actorId,
            CanonicalApiContracts.FriendActionRequest request) {
        return acceptRequest(actorId, request.friendId());
    }

    public CanonicalApiContracts.FriendshipStatusResponse acceptRequest(UUID actorId, UUID senderId) {
        doAcceptOrReject(actorId, senderId, true);
        return listStatus(actorId, "ACCEPTED", 50);
    }

    public void rejectRequest(UUID actorId, CanonicalApiContracts.FriendActionRequest request) {
        rejectRequest(actorId, request.friendId());
    }

    public void rejectRequest(UUID actorId, UUID senderId) {
        doAcceptOrReject(actorId, senderId, false);
    }

    public void cancelRequest(UUID actorId, UUID recipientId) {
        if (actorId.equals(recipientId)) {
            throw new BadRequestException("cannot cancel request to self");
        }
        var request = repository.findRequest(actorId, recipientId);
        if (request == null) {
            throw new NotFoundException("friend request not found");
        }
        if (!repository.markRequestStatus(actorId, recipientId, "CANCELLED", Instant.now())) {
            throw new ConflictException("request is no longer pending");
        }
        repository.removeFriendshipProjection(actorId, recipientId);
        if (request.requestedAt() == null) {
            throw new IllegalStateException("friend request is missing requestedAt");
        }
        repository.deleteRequestInbox(recipientId, request.requestedAt(), actorId);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_REQUEST_CANCEL",
                "friendship",
                recipientId.toString(),
                recipientId,
                null,
                Map.of(),
                Map.of());
    }

    public CanonicalApiContracts.FriendshipStatusResponse listStatus(UUID actorId, String rawStatus, int limit) {
        if (rawStatus == null || rawStatus.isBlank()) {
            throw new BadRequestException("status is required");
        }
        String status = rawStatus.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (status) {
            case "ACCEPTED" -> new CanonicalApiContracts.FriendshipStatusResponse(
                    "ACCEPTED",
                    actorId,
                    listAcceptedByStatus(actorId, limit).stream()
                            .map(FriendshipRepository.FriendProjectionRow::otherUserId)
                            .map(this::toSummary)
                            .toList());
            case "PENDING" -> new CanonicalApiContracts.FriendshipStatusResponse(
                    "PENDING",
                    actorId,
                    listPendingByStatus(actorId, limit).stream()
                            .map(FriendshipRepository.FriendProjectionRow::otherUserId)
                            .map(this::toSummary)
                            .toList());
            case "BLOCKED" -> new CanonicalApiContracts.FriendshipStatusResponse(
                    "BLOCKED",
                    actorId,
                    listBlockedUserSummaries(actorId, limit).stream()
                            .toList());
            default -> throw new BadRequestException("unsupported status");
        };
    }

    public CanonicalApiContracts.FriendshipStatusResponse listIncomingRequests(UUID actorId, int limit) {
        var requests = repository.listIncomingRequests(actorId, limit).stream()
                .map(row -> cqlStore.findUserById(row.requesterId()))
                .map(this::toSummary)
                .toList();
        return new CanonicalApiContracts.FriendshipStatusResponse("PENDING", actorId, requests);
    }

    public List<CanonicalApiContracts.FriendUserSummary> listMutualFriends(UUID actorId, UUID otherUserId, int limit) {
        if (actorId.equals(otherUserId)) {
            return List.of();
        }
        Set<UUID> actorFriends = listAcceptedByStatus(actorId, 2000).stream()
                .map(FriendshipRepository.FriendProjectionRow::otherUserId)
                .collect(Collectors.toSet());
        Set<UUID> otherFriends = listAcceptedByStatus(otherUserId, 2000).stream()
                .map(FriendshipRepository.FriendProjectionRow::otherUserId)
                .collect(Collectors.toSet());
        otherFriends.retainAll(actorFriends);
        return otherFriends.stream()
                .limit(limit)
                .map(cqlStore::findUserById)
                .map(this::toSummary)
                .toList();
    }

    public CanonicalApiContracts.BlockStatusView blockStatus(UUID actorId, UUID otherUserId) {
        return new CanonicalApiContracts.BlockStatusView(
                repository.isBlocked(actorId, otherUserId),
                repository.isBlocked(otherUserId, actorId));
    }

    public void blockUser(UUID actorId, UUID otherUserId, String reasonText) {
        if (actorId.equals(otherUserId)) {
            throw new BadRequestException("cannot block self");
        }
        CanonicalUser other = cqlStore.findUserById(otherUserId);
        if (other == null) {
            throw new NotFoundException("user not found");
        }
        repository.blockUser(actorId, otherUserId, reasonText);
        repository.removeFriendshipProjection(actorId, otherUserId);
        repository.removeFriendshipProjection(otherUserId, actorId);
        var pair = repository.findFriendshipPair(actorId, otherUserId);
        if (pair != null && "ACCEPTED".equals(pair.status())) {
            repository.markFriendshipRemoved(actorId, otherUserId, Instant.now());
        }
        clearRequestIfPresent(actorId, otherUserId);
        clearRequestIfPresent(otherUserId, actorId);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_BLOCK",
                "friendship",
                otherUserId.toString(),
                otherUserId,
                null,
                Map.of(),
                Map.of());
    }

    public void unblockUser(UUID actorId, UUID otherUserId) {
        if (actorId.equals(otherUserId)) {
            throw new BadRequestException("cannot unblock self");
        }
        repository.unblockUser(actorId, otherUserId);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_UNBLOCK",
                "friendship",
                otherUserId.toString(),
                otherUserId,
                null,
                Map.of(),
                Map.of());
    }

    public void unfriend(UUID actorId, UUID otherUserId) {
        if (actorId.equals(otherUserId)) {
            throw new BadRequestException("cannot unfriend self");
        }
        var pair = repository.findFriendshipPair(actorId, otherUserId);
        if (pair == null || !"ACCEPTED".equals(pair.status())) {
            throw new NotFoundException("friendship not found");
        }
        repository.markFriendshipRemoved(actorId, otherUserId, Instant.now());
        repository.removeFriendshipProjection(actorId, otherUserId);
        repository.removeFriendshipProjection(otherUserId, actorId);
        clearRequestIfPresent(actorId, otherUserId);
        clearRequestIfPresent(otherUserId, actorId);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_REMOVE",
                "friendship",
                otherUserId.toString(),
                otherUserId,
                null,
                Map.of(),
                Map.of());
    }

    private void doAcceptOrReject(UUID actorId, UUID senderId, boolean accept) {
        if (actorId.equals(senderId)) {
            throw new BadRequestException("cannot accept from self");
        }
        var request = repository.findRequest(senderId, actorId);
        if (request == null || !"PENDING".equals(request.status())) {
            throw new NotFoundException("friend request not found");
        }
        if (accept) {
            acceptRequestInternal(actorId, senderId, request);
        } else {
            declineRequestInternal(actorId, senderId, request);
        }
    }

    private void acceptRequestInternal(UUID actorId, UUID senderId, FriendshipRepository.RequestRow request) {
        if (!repository.markRequestStatus(senderId, actorId, "ACCEPTED", Instant.now())) {
            throw new ConflictException("request is no longer pending");
        }
        Instant acceptedAt = Instant.now();
        Instant requestedAt = timeuuidToInstant(request.requestedAt());
        UUID projectionTime = Uuids.timeBased();
        repository.upsertFriendshipPair(
                senderId,
                actorId,
                "ACCEPTED",
                senderId,
                requestedAt,
                acceptedAt,
                acceptedAt);
        repository.removeFriendshipProjection(senderId, actorId);
        repository.removeFriendshipProjection(actorId, senderId);
        repository.upsertFriendshipProjection(senderId, actorId, "ACCEPTED", projectionTime, requestedAt, acceptedAt);
        repository.upsertFriendshipProjection(actorId, senderId, "ACCEPTED", projectionTime, requestedAt, acceptedAt);
        repository.deleteRequestInbox(actorId, request.requestedAt(), senderId);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_REQUEST_ACCEPT",
                "friendship",
                senderId.toString(),
                senderId,
                null,
                Map.of(),
                Map.of());
        friendRequestNotificationService.sendFriendRequestAccepted(senderId, actorId, request.requestedAt());
    }

    private void declineRequestInternal(UUID actorId, UUID senderId, FriendshipRepository.RequestRow request) {
        if (!repository.markRequestStatus(senderId, actorId, "DECLINED", Instant.now())) {
            throw new ConflictException("request is no longer pending");
        }
        repository.removeFriendshipProjection(senderId, actorId);
        repository.deleteRequestInbox(actorId, request.requestedAt(), senderId);
        eventRecorder.record(
                actorId,
                null,
                "FRIEND_REQUEST_DECLINE",
                "friendship",
                senderId.toString(),
                senderId,
                null,
                Map.of(),
                Map.of());
    }

    private void clearRequestIfPresent(UUID requesterId, UUID recipientId) {
        var request = repository.findRequest(requesterId, recipientId);
        if (request == null) {
            return;
        }
        if ("PENDING".equals(request.status())) {
            repository.markRequestStatus(requesterId, recipientId, "CANCELLED", Instant.now());
        } else {
            repository.forceUpdateRequestStatus(requesterId, recipientId, "CANCELLED", Instant.now());
        }
        repository.removeFriendshipProjection(requesterId, recipientId);
        if (request.requestedAt() == null) {
            throw new IllegalStateException("friend request is missing requestedAt");
        }
        repository.deleteRequestInbox(recipientId, request.requestedAt(), requesterId);
    }

    private List<FriendshipRepository.FriendProjectionRow> listAcceptedByStatus(UUID actorId, int limit) {
        return repository.listFriendshipByStatus(actorId, "ACCEPTED", limit);
    }

    private List<FriendshipRepository.FriendProjectionRow> listPendingByStatus(UUID actorId, int limit) {
        return repository.listFriendshipByStatus(actorId, "PENDING_OUTGOING", limit);
    }

    private CanonicalApiContracts.FriendUserSummary toSummary(UUID userId) {
        if (userId == null) {
            throw new IllegalStateException("friend projection is missing userId");
        }
        return toSummary(cqlStore.findUserById(userId));
    }

    private CanonicalApiContracts.FriendUserSummary toSummary(CanonicalUser user) {
        if (user == null) {
            throw new IllegalStateException("friend projection references a missing user");
        }
        return new CanonicalApiContracts.FriendUserSummary(
                user.userId(),
                user.username(),
                user.displayName(),
                user.avatarUrl(),
                user.accountStatus());
    }

    private List<CanonicalApiContracts.FriendUserSummary> listBlockedUserSummaries(UUID actorId, int limit) {
        return repository.listBlockedUsers(actorId, limit).stream()
                .map(FriendshipRepository.BlockRow::blockedUserId)
                .map(this::toSummary)
                .toList();
    }

    private Instant timeuuidToInstant(UUID timeUuid) {
        return Instant.ofEpochMilli(Uuids.unixTimestamp(timeUuid));
    }
}
