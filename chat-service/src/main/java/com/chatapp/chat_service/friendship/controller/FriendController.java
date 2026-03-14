package com.chatapp.chat_service.friendship.controller;

import com.chatapp.chat_service.friendship.dto.FriendDTO;
import com.chatapp.chat_service.friendship.dto.FriendRequestResponse;
import com.chatapp.chat_service.friendship.dto.FriendRequestsResponse;
import com.chatapp.chat_service.friendship.entity.Friendship;
import com.chatapp.chat_service.friendship.service.FriendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
public class FriendController {
    private final FriendService friendshipService;
    private final SecurityContextHelper securityContextHelper;
    public FriendController(FriendService friendService,
                            SecurityContextHelper securityContextHelper) {
        this.friendshipService = friendService;
        this.securityContextHelper = securityContextHelper;
    }

    @GetMapping("/requests/sent")
    public ResponseEntity<FriendRequestsResponse> getSentRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        UUID userId = securityContextHelper.getCurrentUserId();
        return ResponseEntity.ok(
                friendshipService.getFriendRequestsWithDetails(userId, org.springframework.data.domain.PageRequest.of(page, size))
        );
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<FriendRequestsResponse> getFriendshipsByStatus(
            @PathVariable String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        UUID userId = securityContextHelper.getCurrentUserId();
        return ResponseEntity.ok(friendshipService.getFriendDetailsByStatus(userId, status, org.springframework.data.domain.PageRequest.of(page, size)));
    }
    @PostMapping("/request")
    public ResponseEntity<Void> sendFriendRequest(
            @RequestBody FriendRequestResponse request) {
        UUID senderId = securityContextHelper.getCurrentUserId();
        friendshipService.sendFriendRequest(
                senderId,
                request.getReceiverId()
        );
        return ResponseEntity.accepted().build();
    }
    
    @PutMapping("/accept")
    public ResponseEntity<Void> acceptFriendRequest(
            @RequestBody FriendRequestResponse response) {
        UUID receiverId = securityContextHelper.getCurrentUserId();
        friendshipService.acceptFriendRequest(
                receiverId,
                response.getSenderId()
        );
        return ResponseEntity.ok().build();
    }
    @GetMapping("/")
    public ResponseEntity<List<FriendDTO>> getFriends(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        UUID userId = securityContextHelper.getCurrentUserId();
        List<FriendDTO> friends = friendshipService.getFriendsWithDetails(userId, org.springframework.data.domain.PageRequest.of(page, size));
        return ResponseEntity.ok(friends);
    }
    @GetMapping("/requests/received")
    public ResponseEntity<FriendRequestsResponse> getReceivedRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        UUID userId = securityContextHelper.getCurrentUserId();
        return ResponseEntity.ok(
                friendshipService.getReceivedFriendRequestsWithDetails(userId, org.springframework.data.domain.PageRequest.of(page, size))
        );
    }
    @PutMapping("/reject")
    public ResponseEntity<Void> rejectFriendRequest(
            @RequestBody FriendRequestResponse response) {
        UUID receiverId = securityContextHelper.getCurrentUserId();
        friendshipService.rejectFriendRequest(
                receiverId,
                response.getSenderId()
        );
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> unfriend(@PathVariable UUID friendId) {
        UUID userId = securityContextHelper.getCurrentUserId();
        friendshipService.unfriend(userId, friendId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/block/{userIdToBlock}")
    public ResponseEntity<Void> blockUser(@PathVariable UUID userIdToBlock) {
        UUID blockerId = securityContextHelper.getCurrentUserId();
        friendshipService.blockUser(blockerId, userIdToBlock);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/unblock/{userIdToUnblock}")
    public ResponseEntity<Void> unblockUser(@PathVariable UUID userIdToUnblock) {
        UUID blockerId = securityContextHelper.getCurrentUserId();
        friendshipService.unblockUser(blockerId, userIdToUnblock);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/check-block/{otherUserId}")
    public ResponseEntity<java.util.Map<String, Boolean>> checkBlockStatus(@PathVariable UUID otherUserId) {
        UUID userId = securityContextHelper.getCurrentUserId();
        boolean hasBlocked = friendshipService.hasBlocked(userId, otherUserId);
        boolean isBlockedBy = friendshipService.hasBlocked(otherUserId, userId);
        
        java.util.Map<String, Boolean> response = new java.util.HashMap<>();
        response.put("hasBlocked", hasBlocked);
        response.put("isBlockedBy", isBlockedBy);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mutual/{otherUserId}")
    public ResponseEntity<List<UserDTO>> getMutualFriends(@PathVariable UUID otherUserId) {
        UUID userId = securityContextHelper.getCurrentUserId();
        return ResponseEntity.ok(friendshipService.getMutualFriends(userId, otherUserId));
    }
}