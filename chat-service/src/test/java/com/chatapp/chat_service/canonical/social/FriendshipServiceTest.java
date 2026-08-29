package com.chatapp.chat_service.canonical.social;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.FriendRequestNotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FriendshipServiceTest {

    @Mock
    private CanonicalEventRecorder eventRecorder;
    @Mock
    private CanonicalCqlStore cqlStore;
    @Mock
    private FriendshipRepository repository;
    @Mock
    private FriendRequestNotificationService notificationService;

    @Test
    void acceptedStatusMapsTheOtherUserFromTheProjection() {
        UUID actorId = UUID.randomUUID();
        UUID friendId = UUID.randomUUID();
        when(repository.listFriendshipByStatus(actorId, "ACCEPTED", 25))
                .thenReturn(List.of(new FriendshipRepository.FriendProjectionRow(
                        friendId, "ACCEPTED", UUID.randomUUID(), Instant.now(), Instant.now())));
        when(cqlStore.findUserById(friendId)).thenReturn(user(friendId, "friend"));

        var response = service().listStatus(actorId, "accepted", 25);

        assertThat(response.status()).isEqualTo("ACCEPTED");
        assertThat(response.userDetails()).singleElement()
                .extracting(summary -> summary.userId())
                .isEqualTo(friendId);
    }

    @Test
    void blockedStatusMapsTheBlockedUserRatherThanTheBlocker() {
        UUID actorId = UUID.randomUUID();
        UUID blockedUserId = UUID.randomUUID();
        when(repository.listBlockedUsers(actorId, 25))
                .thenReturn(List.of(new FriendshipRepository.BlockRow(
                        actorId, blockedUserId, Instant.now(), "spam")));
        when(cqlStore.findUserById(blockedUserId)).thenReturn(user(blockedUserId, "blocked"));

        var response = service().listStatus(actorId, "blocked", 25);

        assertThat(response.userDetails()).singleElement()
                .extracting(summary -> summary.userId())
                .isEqualTo(blockedUserId);
    }

    @Test
    void cancelPendingRequestRemovesTheOutgoingProjectionAndRecipientInboxEntry() {
        UUID actorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        when(repository.findRequest(actorId, recipientId))
                .thenReturn(new FriendshipRepository.RequestRow(
                        actorId, recipientId, requestedAt, null, "PENDING", null));
        when(repository.markRequestStatus(eq(actorId), eq(recipientId), eq("CANCELLED"), any(Instant.class)))
                .thenReturn(true);

        service().cancelRequest(actorId, recipientId);

        verify(repository).markRequestStatus(eq(actorId), eq(recipientId), eq("CANCELLED"), any(Instant.class));
        verify(repository).removeFriendshipProjection(actorId, recipientId);
        verify(repository).deleteRequestInbox(recipientId, requestedAt, actorId);
    }

    private FriendshipService service() {
        return new FriendshipService(eventRecorder, cqlStore, repository, notificationService);
    }

    private CanonicalUser user(UUID userId, String username) {
        Instant now = Instant.now();
        return new CanonicalUser(
                userId,
                username,
                username,
                username + "@example.com",
                username + "@example.com",
                "hash",
                "LOCAL",
                null,
                username,
                null,
                "ACTIVE",
                now,
                now,
                null);
    }
}
