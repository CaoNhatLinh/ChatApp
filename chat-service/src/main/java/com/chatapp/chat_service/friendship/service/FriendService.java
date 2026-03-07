package com.chatapp.chat_service.friendship.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.common.exception.BusinessException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.friendship.dto.FriendDTO;
import com.chatapp.chat_service.friendship.dto.FriendRequestsResponse;
import com.chatapp.chat_service.friendship.entity.Friendship;
import com.chatapp.chat_service.friendship.event.FriendshipEvent;
import com.chatapp.chat_service.friendship.repository.FriendshipRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final SecurityContextHelper securityContextHelper;
    private final ApplicationEventPublisher eventPublisher;

    private static final long MAX_FRIENDS = 500;

    // ──────────────────── Query Methods ────────────────────

    public FriendRequestsResponse getFriendDetailsByStatus(UUID userId, String status,
                                                           org.springframework.data.domain.Pageable pageable) {
        UUID currentUserId = securityContextHelper.getCurrentUserId();

        org.springframework.data.domain.Slice<Friendship> friendshipSlice = switch (status.toUpperCase()) {
            case "ACCEPTED" -> friendshipRepository.findAcceptedByUserId(userId, pageable);
            case "PENDING" -> friendshipRepository.findPendingFriendRequests(userId, pageable);
            case "BLOCKED" -> friendshipRepository.findBlockedFriendships(userId, pageable);
            default -> throw new BusinessException("Invalid status: " + status);
        };

        List<Friendship> friendships = friendshipSlice.getContent();

        List<UserDTO> userDetails = friendships.stream()
                .map(f -> f.getKey().getUserId().equals(userId)
                        ? f.getKey().getFriendId()
                        : f.getKey().getUserId())
                .distinct()
                .filter(friendId -> !friendId.equals(currentUserId))
                .map(userRepository::findById)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(UserDTO::new)
                .collect(Collectors.toList());

        return new FriendRequestsResponse(
                userId,
                friendships.isEmpty() ? null : friendships.get(0).getStatus().toString(),
                userDetails
        );
    }

    public FriendRequestsResponse getReceivedFriendRequestsWithDetails(UUID userId,
                                                                       org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Slice<Friendship> friendshipSlice =
                friendshipRepository.findReceivedFriendRequests(userId, pageable);
        List<Friendship> friendships = friendshipSlice.getContent();

        List<UUID> friendIds = friendships.stream()
                .map(f -> f.getKey().getUserId())
                .collect(Collectors.toList());

        List<UserDTO> userDetails = userRepository.findUsersByIds(friendIds)
                .stream()
                .map(UserDTO::new)
                .collect(Collectors.toList());

        return new FriendRequestsResponse(userId, "PENDING", userDetails);
    }

    public List<FriendDTO> getFriendsWithDetails(UUID userId,
                                                 org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Slice<Friendship> friendshipSlice =
                friendshipRepository.findByUserId(userId, pageable);
        List<Friendship> friendships = friendshipSlice.getContent();

        List<UUID> friendIds = friendships.stream()
                .map(f -> f.getKey().getFriendId())
                .collect(Collectors.toList());

        Map<UUID, User> userMap = userRepository.findUsersByIds(friendIds)
                .stream()
                .collect(Collectors.toMap(User::getUserId, Function.identity()));

        return friendships.stream()
                .map(friendship -> {
                    User friend = userMap.get(friendship.getKey().getFriendId());
                    return FriendDTO.fromFriendship(friendship, friend);
                })
                .collect(Collectors.toList());
    }

    public FriendRequestsResponse getFriendRequestsWithDetails(UUID userId,
                                                               org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Slice<Friendship> friendshipSlice =
                friendshipRepository.findPendingFriendRequests(userId, pageable);
        List<Friendship> friendships = friendshipSlice.getContent();

        List<UUID> friendIds = friendships.stream()
                .map(f -> f.getKey().getFriendId())
                .collect(Collectors.toList());

        List<UserDTO> userDetails = userRepository.findUsersByIds(friendIds)
                .stream()
                .map(UserDTO::new)
                .collect(Collectors.toList());

        return new FriendRequestsResponse(
                userId,
                friendships.isEmpty() ? null : String.valueOf(friendships.get(0).getStatus()),
                userDetails
        );
    }

    /**
     * Check if blockerId has blocked targetId.
     */
    public boolean hasBlocked(UUID blockerId, UUID targetId) {
        return friendshipRepository.findByUserIdAndFriendId(blockerId, targetId)
                .map(f -> f.getStatus() == Friendship.Status.BLOCKED)
                .orElse(false);
    }

    // ──────────────────── Command Methods ────────────────────

    public void sendFriendRequest(UUID senderId, UUID receiverId) {
        UUID userId = securityContextHelper.getCurrentUserId();

        if (senderId == null || receiverId == null) {
            throw new BusinessException("Sender and receiver IDs cannot be null");
        }
        if (!senderId.equals(userId)) {
            throw new ConflictException("Sender ID does not match the authenticated user");
        }
        if (senderId.equals(receiverId)) {
            throw new ConflictException("You cannot send a friend request to yourself");
        }

        // Check outgoing relationship
        Optional<Friendship> outRelationship = friendshipRepository.findByUserAndFriend(senderId, receiverId);
        if (outRelationship.isPresent()) {
            Friendship.Status status = outRelationship.get().getStatus();
            if (status == Friendship.Status.ACCEPTED) {
                throw new BusinessException("You are already friends with this user");
            } else if (status == Friendship.Status.PENDING) {
                throw new BusinessException("Friend request is already pending");
            } else if (status == Friendship.Status.BLOCKED) {
                throw new BusinessException("You have blocked this user. Unblock them first to send a request.");
            }
        }

        // Check incoming relationship
        Optional<Friendship> inRelationship = friendshipRepository.findByUserAndFriend(receiverId, senderId);
        if (inRelationship.isPresent()) {
            Friendship.Status status = inRelationship.get().getStatus();
            if (status == Friendship.Status.ACCEPTED) {
                throw new BusinessException("You are already friends with this user");
            } else if (status == Friendship.Status.BLOCKED) {
                throw new BusinessException("You cannot send a friend request to this user");
            } else if (status == Friendship.Status.PENDING) {
                throw new BusinessException("This user has already sent you a friend request. Check your invitations.");
            }
        }

        long currentFriendCount = friendshipRepository
                .findAcceptedByUserId(senderId, org.springframework.data.domain.PageRequest.of(0, 1))
                .get().count();
        if (currentFriendCount >= MAX_FRIENDS) {
            throw new BusinessException("You have reached the maximum limit of " + MAX_FRIENDS + " friends.");
        }

        Friendship friendship = new Friendship();
        friendship.setKey(new Friendship.FriendshipKey(senderId, receiverId));
        friendship.setStatus(Friendship.Status.PENDING);
        friendship.setCreatedAt(Instant.now());
        friendshipRepository.save(friendship);

        // Publish event — notification handled by FriendshipEventListener
        User sender = userRepository.findById(senderId).orElse(null);
        eventPublisher.publishEvent(FriendshipEvent.builder()
                .type(FriendshipEvent.Type.FRIEND_REQUEST_SENT)
                .senderId(senderId)
                .receiverId(receiverId)
                .senderDisplayName(sender != null ? sender.getDisplayName() : null)
                .build());
    }

    public void acceptFriendRequest(UUID receiverId, UUID senderId) {
        if (receiverId == null || senderId == null) {
            throw new BusinessException("Receiver and sender IDs cannot be null");
        }

        Friendship friendship = friendshipRepository.findByUserAndFriend(senderId, receiverId)
                .orElseThrow(() -> new NotFoundException("Friend request not found"));

        Friendship inverseFriendship = friendshipRepository
                .findByUserAndFriend(receiverId, senderId)
                .orElseGet(() -> {
                    Friendship newInverse = new Friendship();
                    newInverse.setKey(new Friendship.FriendshipKey(receiverId, senderId));
                    newInverse.setStatus(Friendship.Status.ACCEPTED);
                    newInverse.setCreatedAt(Instant.now());
                    return newInverse;
                });

        friendship.setStatus(Friendship.Status.ACCEPTED);
        friendship.setUpdatedAt(Instant.now());
        inverseFriendship.setStatus(Friendship.Status.ACCEPTED);
        inverseFriendship.setUpdatedAt(Instant.now());

        friendshipRepository.saveAll(List.of(friendship, inverseFriendship));

        eventPublisher.publishEvent(FriendshipEvent.builder()
                .type(FriendshipEvent.Type.FRIEND_REQUEST_ACCEPTED)
                .senderId(senderId)
                .receiverId(receiverId)
                .build());
    }

    public void rejectFriendRequest(UUID receiverId, UUID senderId) {
        Friendship friendship = friendshipRepository.findByUserAndFriend(senderId, receiverId)
                .orElseThrow(() -> new NotFoundException("Friend request not found"));

        friendship.setStatus(Friendship.Status.REJECTED);
        friendship.setUpdatedAt(Instant.now());
        friendshipRepository.save(friendship);

        eventPublisher.publishEvent(FriendshipEvent.builder()
                .type(FriendshipEvent.Type.FRIEND_REQUEST_REJECTED)
                .senderId(senderId)
                .receiverId(receiverId)
                .build());
    }

    public void unfriend(UUID userId, UUID friendId) {
        if (userId == null || friendId == null) {
            throw new BusinessException("User and friend IDs cannot be null");
        }

        clearExistingRelationships(userId, friendId);

        eventPublisher.publishEvent(FriendshipEvent.builder()
                .type(FriendshipEvent.Type.UNFRIENDED)
                .senderId(userId)
                .receiverId(friendId)
                .build());
    }

    public void blockUser(UUID blockerId, UUID targetId) {
        if (blockerId == null || targetId == null) {
            throw new BusinessException("User IDs cannot be null");
        }
        if (blockerId.equals(targetId)) {
            throw new ConflictException("You cannot block yourself");
        }

        // Clear any existing relationships without publishing UNFRIENDED event
        clearExistingRelationships(blockerId, targetId);

        // Create new block record
        Friendship blockRelationship = new Friendship();
        blockRelationship.setKey(new Friendship.FriendshipKey(blockerId, targetId));
        blockRelationship.setStatus(Friendship.Status.BLOCKED);
        blockRelationship.setCreatedAt(Instant.now());
        blockRelationship.setUpdatedAt(Instant.now());
        friendshipRepository.save(blockRelationship);

        eventPublisher.publishEvent(FriendshipEvent.builder()
                .type(FriendshipEvent.Type.BLOCKED)
                .senderId(blockerId)
                .receiverId(targetId)
                .build());
    }

    /**
     * Reusable: delete relationship records in both directions.
     * Does NOT publish any events — callers are responsible for publishing
     * the appropriate event (UNFRIENDED, BLOCKED, etc.)
     */
    private void clearExistingRelationships(UUID userA, UUID userB) {
        friendshipRepository.deleteByUserIdAndFriendId(userA, userB);
        friendshipRepository.deleteByUserIdAndFriendId(userB, userA);
    }

    public void unblockUser(UUID blockerId, UUID targetId) {
        if (blockerId == null || targetId == null) {
            throw new BusinessException("User IDs cannot be null");
        }

        Friendship friendship = friendshipRepository.findByUserAndFriend(blockerId, targetId)
                .orElseThrow(() -> new BusinessException("You have not blocked this user"));

        if (friendship.getStatus() != Friendship.Status.BLOCKED) {
            throw new BusinessException("You have not blocked this user");
        }

        friendshipRepository.delete(friendship);

        eventPublisher.publishEvent(FriendshipEvent.builder()
                .type(FriendshipEvent.Type.UNBLOCKED)
                .senderId(blockerId)
                .receiverId(targetId)
                .build());
    }
}