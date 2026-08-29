package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.social.FriendshipService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/friends")
public class CanonicalFriendController {
    private final FriendshipService friendshipService;
    private final SecurityContextHelper securityContext;

    public CanonicalFriendController(FriendshipService friendshipService, SecurityContextHelper securityContext) {
        this.friendshipService = friendshipService;
        this.securityContext = securityContext;
    }

    @PostMapping("/request")
    public ResponseEntity<CanonicalApiContracts.FriendshipStatusResponse> sendRequest(
            @RequestBody @Valid CanonicalApiContracts.FriendRequestCreateRequest request) {
        return ResponseEntity.ok(friendshipService.sendFriendRequest(actorId(), request.recipientId(), request.message()));
    }

    @GetMapping("/requests/received")
    public CanonicalApiContracts.FriendshipStatusResponse getReceivedRequests(
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return friendshipService.listIncomingRequests(actorId(), Math.min(200, Math.max(1, limit)));
    }

    @GetMapping("/requests/sent")
    public CanonicalApiContracts.FriendshipStatusResponse getSentRequests(
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return friendshipService.listStatus(actorId(), "PENDING", Math.min(200, Math.max(1, limit)));
    }

    @GetMapping("/status/{status}")
    public CanonicalApiContracts.FriendshipStatusResponse getStatus(
            @PathVariable String status,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return friendshipService.listStatus(actorId(), status, Math.min(200, Math.max(1, limit)));
    }

    @GetMapping
    public CanonicalApiContracts.FriendshipStatusResponse list(@RequestParam(defaultValue = "50") int limit) {
        return friendshipService.listStatus(actorId(), "ACCEPTED", Math.min(200, Math.max(1, limit)));
    }

    @PutMapping("/accept")
    public ResponseEntity<CanonicalApiContracts.FriendshipStatusResponse> accept(@RequestBody @Valid CanonicalApiContracts.FriendActionRequest request) {
        return ResponseEntity.ok(friendshipService.acceptRequest(actorId(), request));
    }

    @PutMapping("/reject")
    public ResponseEntity<Void> reject(@RequestBody @Valid CanonicalApiContracts.FriendActionRequest request) {
        friendshipService.rejectRequest(actorId(), request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/requests/{recipientId}")
    public ResponseEntity<Void> cancel(@PathVariable UUID recipientId) {
        friendshipService.cancelRequest(actorId(), recipientId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> removeFriend(@PathVariable UUID friendId) {
        friendshipService.unfriend(actorId(), friendId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/block/{friendId}")
    public ResponseEntity<Void> block(@PathVariable UUID friendId, @RequestParam(required = false) String reason) {
        friendshipService.blockUser(actorId(), friendId, reason);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/unblock/{friendId}")
    public ResponseEntity<Void> unblock(@PathVariable UUID friendId) {
        friendshipService.unblockUser(actorId(), friendId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/check-block/{friendId}")
    public CanonicalApiContracts.BlockStatusView checkBlock(@PathVariable UUID friendId) {
        return friendshipService.blockStatus(actorId(), friendId);
    }

    @GetMapping("/mutual/{userId}")
    public List<CanonicalApiContracts.FriendUserSummary> mutual(
            @PathVariable UUID userId,
            @RequestParam(name = "limit", defaultValue = "100") int limit) {
        return friendshipService.listMutualFriends(actorId(), userId, Math.min(200, Math.max(1, limit)));
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
