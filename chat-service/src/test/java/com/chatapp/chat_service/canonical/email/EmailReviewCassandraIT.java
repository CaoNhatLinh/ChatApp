package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.Delivery;
import com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.Key;
import com.chatapp.chat_service.canonical.email.EmailReviewRepository.Candidate;
import com.chatapp.chat_service.canonical.email.EmailReviewRepository.Review;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.CassandraContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
final class EmailReviewCassandraIT {
    @Container
    static final CassandraContainer<?> cassandra = new CassandraContainer<>("cassandra:4.1")
            .withEnv("MAX_HEAP_SIZE", "512M").withEnv("HEAP_NEWSIZE", "128M")
            .withStartupTimeout(Duration.ofMinutes(3)).withInitScript("chat_app_complete.cql");

    @Test
    void pagesAcrossFullTupleAndFiltersAgainstCurrentLedger() {
        try (var session = CqlSession.builder().addContactPoint(cassandra.getContactPoint())
                .withLocalDatacenter(cassandra.getLocalDatacenter()).withKeyspace("chat_app").build()) {
            var reviews = new CassandraEmailReviewRepository(session);
            var deliveries = new CassandraEmailDeliveryRepository(session);
            var day = LocalDate.parse("2026-10-02");
            var attemptedAt = Instant.parse("2026-10-02T13:00:00Z");
            UUID tiedId = Uuids.startOf(attemptedAt.toEpochMilli());
            UUID olderId = Uuids.startOf(attemptedAt.minusSeconds(1).toEpochMilli());
            UUID firstUser = new UUID(0, 2), secondUser = new UUID(0, 1);
            var newestMonth = new Candidate(day, new Key(firstUser, "2026-10", tiedId));
            var priorMonth = new Candidate(day, new Key(firstUser, "2026-09", tiedId));
            var otherUser = new Candidate(day, new Key(secondUser, "2026-10", tiedId));
            var absent = new Candidate(day, new Key(secondUser, "2026-10", olderId));
            var otherDay = new Candidate(day.minusDays(1), newestMonth.key());
            List.of(otherUser, absent, newestMonth, otherDay, priorMonth, newestMonth).forEach(reviews::register);

            var firstPage = reviews.list(day, null, 1);
            assertThat(firstPage).containsExactly(newestMonth);
            var secondPage = reviews.list(day, firstPage.get(0), 2);
            assertThat(secondPage).containsExactly(priorMonth, otherUser);
            var thirdPage = reviews.list(day, secondPage.get(1), 2);
            assertThat(thirdPage).containsExactly(absent);
            assertThat(reviews.list(day, thirdPage.get(0), 2)).isEmpty();
            assertThat(reviews.list(otherDay.day(), null, 2)).containsExactly(otherDay);

            var pending = deliveries.initialize(new Delivery(newestMonth.key(), "PENDING", null,
                    "{}", null, null, null, 0, UUID.randomUUID(), null, null));
            var review = pending.change("REVIEW_REQUIRED", null, attemptedAt, null, null, 2, null, "EXHAUSTED");
            assertThat(deliveries.replace(pending, review)).isTrue();
            var keys = List.of(newestMonth.key(), priorMonth.key(), otherUser.key(), absent.key());
            assertThat(reviews.findAll(keys)).hasSize(1)
                    .containsEntry(newestMonth.key(), new Review(2, attemptedAt));

            var delivered = review.change("DELIVERED", "provider-message-id", attemptedAt, null,
                    null, 2, attemptedAt.plusSeconds(10), null);
            assertThat(deliveries.replace(review, delivered)).isTrue();
            assertThat(reviews.findAll(keys)).isEmpty();
            assertThat(reviews.list(day, null, 1)).containsExactly(newestMonth);

            var dispositions = new CassandraEmailReviewDispositionRepository(session);
            var receipt = new EmailReviewDispositionRepository.Receipt(
                    UUID.randomUUID(), firstUser, "Checked provider history", attemptedAt);
            assertThat(dispositions.close(newestMonth.key(), receipt)).isFalse();

            var toClose = deliveries.initialize(new Delivery(priorMonth.key(), "REVIEW_REQUIRED", null,
                    "{}", null, null, null, 0, UUID.randomUUID(), null, null));
            assertThat(reviews.findAll(keys)).containsKey(priorMonth.key());
            assertThat(dispositions.close(priorMonth.key(), receipt)).isTrue();
            assertThat(dispositions.close(priorMonth.key(), new EmailReviewDispositionRepository.Receipt(
                    UUID.randomUUID(), secondUser, "Different decision", attemptedAt))).isFalse();
            assertThat(reviews.findAll(keys)).isEmpty();
            assertThat(deliveries.find(priorMonth.key()).reviewedAt()).isEqualTo(attemptedAt);

            var lateDelivery = toClose.change("DELIVERED", "late-provider-id", attemptedAt, null,
                    null, 0, attemptedAt.plusSeconds(15), null);
            assertThat(deliveries.replace(toClose, lateDelivery)).isTrue();
            assertThat(dispositions.find(priorMonth.key()))
                    .isEqualTo(new EmailReviewDispositionRepository.State("DELIVERED", receipt));
        }
    }
}
