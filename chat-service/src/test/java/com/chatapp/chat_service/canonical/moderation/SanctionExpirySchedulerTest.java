package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SanctionExpirySchedulerTest {
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final SanctionExpiryScheduler scheduler = new SanctionExpiryScheduler(
            repository, store, events, 7, 100);

    @Test
    void expiredAppBanRestoresAccountAndRecordsExpiry() {
        UUID userId = UUID.randomUUID();
        Instant expiresAt = Instant.now().minusSeconds(5);
        ModerationRepository.SanctionRow sanction = sanction(
                userId, null, "APP", "BAN", expiresAt);
        when(repository.listDueSanctions(any(Instant.class), eq(7), eq(100)))
                .thenReturn(List.of(sanction));
        when(repository.isSanctionActive(sanction)).thenReturn(true);
        when(repository.hasActiveAppAccountLock(eq(userId), any(Instant.class))).thenReturn(false);
        when(store.findUserById(userId)).thenReturn(user(userId, "BANNED"));
        when(repository.markSanctionExpired(sanction)).thenReturn(true);

        scheduler.expireDueSanctions();

        verify(store).updateUserAccountStatus(eq(userId), eq("ACTIVE"), any(Instant.class));
        verify(repository).markSanctionExpired(sanction);
        verify(events).record(isNull(), isNull(), eq("SANCTION_EXPIRED"), eq("user_sanction"),
                anyString(), eq(userId), eq("SANCTION_EXPIRED"), anyMap(), anyMap(), anyMap());
    }

    @Test
    void overlappingAppSanctionDoesNotRestoreAccount() {
        UUID userId = UUID.randomUUID();
        ModerationRepository.SanctionRow sanction = sanction(
                userId, null, "APP", "SUSPEND", Instant.now().minusSeconds(5));
        when(repository.listDueSanctions(any(Instant.class), eq(7), eq(100)))
                .thenReturn(List.of(sanction));
        when(repository.isSanctionActive(sanction)).thenReturn(true);
        when(repository.hasActiveAppAccountLock(eq(userId), any(Instant.class))).thenReturn(true);
        when(repository.markSanctionExpired(sanction)).thenReturn(true);

        scheduler.expireDueSanctions();

        verify(store, never()).findUserById(any());
        verify(store, never()).updateUserAccountStatus(any(), anyString(), any());
        verify(repository).markSanctionExpired(sanction);
    }

    @Test
    void expiredConversationMuteClearsMuteAndPreservesInterval() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant expiresAt = Instant.now().minusSeconds(5);
        ModerationRepository.SanctionRow sanction = sanction(
                userId, conversationId, "CONVERSATION", "MUTE", expiresAt);
        CanonicalConversationMember member = new CanonicalConversationMember(
                conversationId, userId, Set.of(), Instant.now().minusSeconds(60), null,
                expiresAt, 15, null, null, null);
        when(repository.listDueSanctions(any(Instant.class), eq(7), eq(100)))
                .thenReturn(List.of(sanction));
        when(repository.isSanctionActive(sanction)).thenReturn(true);
        when(store.findConversationMember(conversationId, userId)).thenReturn(member);
        when(repository.markSanctionExpired(sanction)).thenReturn(true);

        scheduler.expireDueSanctions();

        verify(store).clearMemberMuteIfExpiresAt(conversationId, userId, expiresAt);
        verify(repository).markSanctionExpired(sanction);
    }

    @Test
    void failedSideEffectLeavesProjectionActiveForRetry() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        ModerationRepository.SanctionRow sanction = sanction(
                userId, conversationId, "CONVERSATION", "BAN", Instant.now().minusSeconds(5));
        when(repository.listDueSanctions(any(Instant.class), eq(7), eq(100)))
                .thenReturn(List.of(sanction));
        when(repository.isSanctionActive(sanction)).thenReturn(true);
        doThrow(new IllegalStateException("store unavailable"))
                .when(store).clearConversationBanIfExpiresAt(eq(conversationId), eq(userId), any(Instant.class));

        scheduler.expireDueSanctions();

        verify(repository, never()).markSanctionExpired(any());
        verify(events, never()).record(any(), any(), eq("SANCTION_EXPIRED"), anyString(),
                anyString(), any(), anyString(), anyMap(), anyMap(), anyMap());
    }

    @Test
    void staleExpiryProjectionForRevokedSourceIsIgnored() {
        UUID userId = UUID.randomUUID();
        ModerationRepository.SanctionRow sanction = sanction(
                userId, null, "APP", "BAN", Instant.now().minusSeconds(5));
        when(repository.listDueSanctions(any(Instant.class), eq(7), eq(100)))
                .thenReturn(List.of(sanction));
        when(repository.isSanctionActive(sanction)).thenReturn(false);

        scheduler.expireDueSanctions();

        verify(repository, never()).markSanctionExpired(any());
        verifyNoInteractions(store, events);
    }

    private static ModerationRepository.SanctionRow sanction(
            UUID userId, UUID conversationId, String scope, String type, Instant expiresAt) {
        return new ModerationRepository.SanctionRow(
                userId, UUID.randomUUID(), UUID.randomUUID(), scope, conversationId, type,
                expiresAt.minusSeconds(60), expiresAt, UUID.randomUUID(), "ABUSE", "test",
                "ACTIVE", null, null);
    }

    private static CanonicalUser user(UUID userId, String status) {
        return new CanonicalUser(userId, "target", "target", "target@example.com", "target@example.com",
                "hash", "LOCAL", null, "Target", null, status, Instant.now(), Instant.now(), null);
    }
}
