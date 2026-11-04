package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotification;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalNotificationSettings;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.notification.NotificationRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationEmailWorkerTest {
    @Mock EmailDeliveryRepository deliveries;
    @Mock EmailReviewRepository reviews;
    @Mock NotificationRepository notifications;
    @Mock UserRepository users;
    @Mock ResendEmailClient client;
    final ObjectMapper json = new ObjectMapper();
    final Instant now = Instant.parse("2026-10-12T01:00:00Z");
    final Key key = new Key(UUID.randomUUID(), "2026-10", UUID.randomUUID());
    final Job job = new Job(key, now.minusSeconds(30));
    final ResendSettings settings = new ResendSettings(true, "re_test", "Nối <onboarding@resend.dev>", "", "http://localhost:3000", "owner@example.com");
    NotificationEmailWorker worker;

    @BeforeEach void setup() {
        worker = new NotificationEmailWorker(deliveries, reviews, notifications, users, settings, client, json);
    }
    void eligible() {
        when(notifications.find(key.userId(), key.month(), key.notificationId())).thenReturn(new CanonicalNotification(
                key.userId(), key.month(), key.notificationId(), "MENTION", "NORMAL", null, null, null, null,
                "Private name", "Private message", "/app", Map.of(), false, null, now));
        when(users.findById(key.userId())).thenReturn(user("owner@example.com"));
        when(notifications.findSettings(key.userId())).thenReturn(prefs("ALL", true, null, null));
        when(deliveries.conversationEligible(key.userId(), null, false)).thenReturn(true);
    }
    CanonicalUser user(String email) {
        return new CanonicalUser(key.userId(), "owner", "owner", email, email, null, "LOCAL", null,
                "Owner", null, "ACTIVE", now, now, now);
    }
    CanonicalNotificationSettings prefs(String level, boolean email, String start, String end) {
        return new CanonicalNotificationSettings(key.userId(), level, false, email, false, false, start, end, "Asia/Ho_Chi_Minh", now);
    }
    Delivery existing(String status, int attempts, Instant lease, Instant retry) {
        return new Delivery(key, status, null, NotificationEmailTemplate.render(json, settings, key, "owner@example.com"),
                now.minusSeconds(60), lease, retry, attempts, UUID.randomUUID(), null, null);
    }
    @Test void savesImmutablePayloadBeforeSendingAndMarksSentNotDelivered() {
        eligible();
        when(deliveries.initialize(any())).thenAnswer(call -> call.getArgument(0));
        when(deliveries.replace(any(), any())).thenReturn(true);
        when(client.send(any())).thenAnswer(call -> {
            Delivery claimed = call.getArgument(0);
            assertThat(claimed.requestJson()).doesNotContain("Private name", "Private message");
            assertThat(claimed.status()).isEqualTo("SENDING");
            return new ResendEmailClient.Result(UUID.randomUUID().toString(), false, null);
        });
        assertThat(worker.process(job, now)).isTrue();
        var order = inOrder(deliveries, client);
        order.verify(deliveries).initialize(any());
        order.verify(deliveries).replace(any(), argThat(value -> "SENDING".equals(value.status())));
        order.verify(client).send(any());
        order.verify(deliveries).replace(any(), argThat(value -> "SENT".equals(value.status()) && value.deliveredAt() == null));
        order.verify(deliveries).remove(job);
    }
    @Test void missingNotificationIsDeferredUntilBatchRepairOrExpiry() {
        assertThat(worker.process(job, now)).isFalse();
        verifyNoInteractions(client);
        verify(deliveries, never()).remove(job);
    }
    @Test void existingTerminalDeliveryNeverSendsAgainAfterQueueReplay() {
        when(deliveries.find(key)).thenReturn(existing("SENT", 1, null, null));
        assertThat(worker.process(job, now)).isFalse();
        verifyNoInteractions(client, notifications, users);
    }
    @Test void activeLeaseAndBackoffPreventConcurrentAttempts() {
        when(deliveries.find(key)).thenReturn(existing("SENDING", 1, now.plusSeconds(30), null));
        assertThat(worker.process(job, now)).isFalse();
        when(deliveries.find(key)).thenReturn(existing("RETRY", 1, null, now.plusSeconds(30)));
        assertThat(worker.process(job, now)).isFalse();
        verifyNoInteractions(client, notifications, users);
    }
    @Test void losingClaimNeverSends() {
        eligible();
        when(deliveries.initialize(any())).thenAnswer(call -> call.getArgument(0));
        assertThat(worker.process(job, now)).isFalse();
        verifyNoInteractions(client);
    }
    @Test void retryUsesPersistedPayloadAndDoesNotRemoveJob() {
        eligible();
        when(deliveries.find(key)).thenReturn(existing("RETRY", 1, null, null));
        when(deliveries.replace(any(), any())).thenReturn(true);
        when(client.send(any())).thenReturn(new ResendEmailClient.Result(null, true, "RESEND_HTTP_429"));
        assertThat(worker.process(job, now)).isTrue();
        verify(deliveries).replace(any(), argThat(value -> "RETRY".equals(value.status()) && value.retryAt().isAfter(now)));
        verify(deliveries, never()).remove(any());
    }
    @Test void exactRetryDeadlineIsQuarantinedWithoutSending() {
        when(deliveries.find(key)).thenReturn(existing("RETRY", 2, null, null));
        when(deliveries.replace(any(), any())).thenReturn(true);
        assertThat(worker.process(new Job(key, now.minusSeconds(20 * 3600)), now)).isFalse();
        verify(client, never()).send(any());
        verify(deliveries).replace(any(), argThat(value -> "REVIEW_REQUIRED".equals(value.status())));
    }
    @Test void expiryWithoutLedgerCreatesTerminalRowBeforeRemovingQueuePointer() {
        var expired = new Job(key, now.minusSeconds(21 * 3600));
        when(deliveries.initialize(any())).thenAnswer(call -> call.getArgument(0));
        assertThat(worker.process(expired, now)).isFalse();
        var order = inOrder(reviews, deliveries);
        order.verify(reviews).register(new EmailReviewRepository.Candidate(
                expired.createdAt().atOffset(java.time.ZoneOffset.UTC).toLocalDate(), key));
        order.verify(deliveries).initialize(argThat(next -> "REVIEW_REQUIRED".equals(next.status())
                && "EMAIL_RETRY_WINDOW_EXHAUSTED".equals(next.failureCode()) && next.attempts() == 0));
        order.verify(deliveries).remove(expired);
        verify(deliveries, never()).replace(any(), any());
        verifyNoInteractions(client);
    }
    @Test void indexFailureLeavesExpiredJobForReplay() {
        var expired = new Job(key, now.minusSeconds(21 * 3600));
        doThrow(new IllegalStateException("index unavailable")).when(reviews).register(any());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> worker.process(expired, now))
                .isInstanceOf(IllegalStateException.class);
        verify(deliveries, never()).initialize(any());
        verify(deliveries, never()).replace(any(), any());
        verify(deliveries, never()).remove(any());
        verifyNoInteractions(client);
    }
    @Test void expiredJobDoesNotQuarantineACompetingWorkerWithAnActiveLease() {
        var expiredJob = new Job(key, now.minusSeconds(21 * 3600));
        when(deliveries.find(key)).thenReturn(null);
        when(deliveries.initialize(any())).thenReturn(existing("SENDING", 1, now.plusSeconds(30), null));

        assertThat(worker.process(expiredJob, now)).isFalse();

        verify(deliveries).initialize(any());
        verify(deliveries, never()).replace(any(), any());
        verify(deliveries, never()).remove(any());
        verifyNoInteractions(client);
    }
    @Test void webhookWinningCompletionCasIsNeverOverwrittenOrDeleted() {
        eligible();
        when(deliveries.find(key)).thenReturn(existing("RETRY", 1, null, null));
        when(deliveries.replace(any(), any())).thenReturn(true, false);
        when(client.send(any())).thenReturn(new ResendEmailClient.Result(UUID.randomUUID().toString(), false, null));
        assertThat(worker.process(job, now)).isTrue();
        verify(deliveries, never()).remove(any());
    }
    @Test void respectsOvernightQuietHoursAndExactEnd() {
        assertThat(NotificationEmailWorker.quiet("22:00", "08:00", "Asia/Ho_Chi_Minh", now.minusSeconds(60))).isTrue();
        assertThat(NotificationEmailWorker.quiet("22:00", "08:00", "Asia/Ho_Chi_Minh", now)).isFalse();
        assertThat(NotificationEmailWorker.quiet("08:00", "08:00", "UTC", now)).isTrue();
    }
    @Test void disabledConsentIsSkippedWithoutProviderRequest() {
        when(deliveries.find(key)).thenReturn(existing("PENDING", 0, null, null));
        when(notifications.find(key.userId(), key.month(), key.notificationId())).thenReturn(new CanonicalNotification(
                key.userId(), key.month(), key.notificationId(), "MENTION", "NORMAL", null, null, null, null,
                "Private name", "Private message", "/app", Map.of(), false, null, now));
        when(users.findById(key.userId())).thenReturn(user("owner@example.com"));
        when(notifications.findSettings(key.userId())).thenReturn(prefs("ALL", false, null, null));
        when(deliveries.replace(any(), any())).thenReturn(true);
        assertThat(worker.process(job, now)).isFalse();
        verify(deliveries).replace(any(), argThat(next -> "SKIPPED".equals(next.status())));
        verifyNoInteractions(client);
    }
    @Test void suppressedRecipientIsSkippedEvenWithConsent() {
        eligible();
        when(deliveries.find(key)).thenReturn(existing("PENDING", 0, null, null));
        when(deliveries.suppressed("owner@example.com")).thenReturn(true);
        when(deliveries.replace(any(), any())).thenReturn(true);
        assertThat(worker.process(job, now)).isFalse();
        verifyNoInteractions(client);
        verify(deliveries).remove(job);
    }
    @Test void initRaceRechecksTerminalStateBeforeSending() {
        eligible();
        when(deliveries.initialize(any())).thenReturn(existing("DELIVERED", 1, null, null));
        assertThat(worker.process(job, now)).isFalse();
        verify(deliveries).remove(job);
        verifyNoInteractions(client);
    }
    @Test void initRaceCannotClaimAnEleventhAttempt() {
        eligible();
        var exhausted = existing("RETRY", 10, null, now);
        when(deliveries.initialize(any())).thenReturn(exhausted);
        when(deliveries.replace(eq(exhausted), any())).thenReturn(true);

        assertThat(worker.process(job, now)).isFalse();

        var order = inOrder(reviews, deliveries);
        order.verify(reviews).register(new EmailReviewRepository.Candidate(
                job.createdAt().atOffset(ZoneOffset.UTC).toLocalDate(), key));
        order.verify(deliveries).replace(eq(exhausted), argThat(next ->
                "REVIEW_REQUIRED".equals(next.status()) && next.attempts() == 10));
        order.verify(deliveries).remove(job);
        verifyNoInteractions(client);
    }
    @Test void initRaceDoesNotQuarantineUntilTheLastAttemptBackoffExpires() {
        eligible();
        when(deliveries.initialize(any())).thenReturn(existing("RETRY", 10, null, now.plusSeconds(30)));

        assertThat(worker.process(job, now)).isFalse();

        verify(deliveries, never()).replace(any(), any());
        verify(deliveries, never()).remove(any());
        verifyNoInteractions(client, reviews);
    }
    @Test void initRaceRegistersTerminalReviewBeforeRemovingQueuePointer() {
        eligible();
        when(deliveries.initialize(any())).thenReturn(existing("REVIEW_REQUIRED", 10, null, null));

        assertThat(worker.process(job, now)).isFalse();

        var order = inOrder(reviews, deliveries);
        order.verify(reviews).register(new EmailReviewRepository.Candidate(
                job.createdAt().atOffset(ZoneOffset.UTC).toLocalDate(), key));
        order.verify(deliveries).remove(job);
        verify(deliveries, never()).replace(any(), any());
        verifyNoInteractions(client);
    }
    @Test void shardCursorMovesPastDeferredJobsAndWrapsAtEnd() {
        when(deliveries.pending(0, null, 100)).thenReturn(java.util.List.of(job));
        worker.tick();
        for (int tick = 0; tick < 16; tick++) worker.tick();
        verify(deliveries).pending(0, key, 100);
        for (int tick = 0; tick < 16; tick++) worker.tick();
        verify(deliveries, times(2)).pending(0, null, 100);
        verifyNoInteractions(client);
    }
}
