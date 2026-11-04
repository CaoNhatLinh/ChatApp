package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.notification.NotificationRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.*;

@Component
public class NotificationEmailWorker {
    private static final Logger log = LoggerFactory.getLogger(NotificationEmailWorker.class);
    private static final int MAX_ATTEMPTS = 10;
    // Leave a margin before the provider's idempotency-key retention expires.
    private static final Duration RETRY_WINDOW = Duration.ofHours(20);
    private final EmailDeliveryRepository deliveries;
    private final EmailReviewRepository reviews;
    private final NotificationRepository notifications;
    private final UserRepository users;
    private final ResendSettings settings;
    private final ResendEmailClient client;
    private final ObjectMapper json;
    private int shard;
    private final Key[] cursors = new Key[16];

    public NotificationEmailWorker(EmailDeliveryRepository deliveries, EmailReviewRepository reviews, NotificationRepository notifications,
                                  UserRepository users, ResendSettings settings, ResendEmailClient client, ObjectMapper json) {
        this.deliveries = deliveries;
        this.reviews = reviews;
        this.notifications = notifications;
        this.users = users;
        this.settings = settings;
        this.client = client;
        this.json = json;
    }

    @Scheduled(fixedDelayString = "${app.email.poll-delay-ms:1000}")
    public void tick() {
        if (!settings.enabled) return;
        int currentShard = shard;
        shard = (shard + 1) % 16;
        try {
            var jobs = deliveries.pending(currentShard, cursors[currentShard], 100);
            if (jobs.isEmpty()) cursors[currentShard] = null;
            for (Job job : jobs) {
                cursors[currentShard] = job.key();
                if (process(job, Instant.now())) break; // At most one provider request per tick per instance.
            }
        } catch (RuntimeException exception) {
            log.warn("Email queue processing deferred: {}", exception.getClass().getSimpleName());
        }
    }

    boolean process(Job job, Instant now) {
        Delivery delivery = deliveries.find(job.key());
        if (delivery != null && delivery.finished()) {
            removeFinished(job, delivery);
            return false;
        }
        if (delivery != null && deferred(delivery, now)) return false;
        if (!job.createdAt().plus(RETRY_WINDOW).isAfter(now) || (delivery != null && delivery.attempts() >= MAX_ATTEMPTS)) {
            stop(job, delivery, now, "REVIEW_REQUIRED", "EMAIL_RETRY_WINDOW_EXHAUSTED");
            return false;
        }
        var key = job.key();
        var notification = notifications.find(key.userId(), key.month(), key.notificationId());
        // Logged cross-partition batches guarantee repair, not atomic visibility. Retry until the source is visible.
        if (notification == null) return false;
        var user = users.findById(key.userId());
        var prefs = notifications.findSettings(key.userId());
        if (Boolean.TRUE.equals(notification.isRead()) || user == null
                || !"ACTIVE".equals(user.accountStatus()) || !settings.allows(user.email())
                || prefs == null || !Boolean.TRUE.equals(prefs.emailEnabled()) || "NONE".equals(prefs.globalLevel())
                || ("MENTIONS".equals(prefs.globalLevel()) && !"MENTION".equals(notification.notificationType()))
                || !deliveries.conversationEligible(key.userId(), notification.conversationId(), "DIRECT_ONLY".equals(prefs.globalLevel()))
                || deliveries.suppressed(user.email())) {
            stop(job, delivery, now, "SKIPPED", "EMAIL_NOT_ELIGIBLE");
            return false;
        }
        if (delivery == null) {
            delivery = deliveries.initialize(new Delivery(key, "PENDING", null,
                    NotificationEmailTemplate.render(json, settings, key, ResendSettings.normalizeEmail(user.email())),
                    null, null, null, 0, UUID.randomUUID(), null, null));
        }
        if (delivery == null) return false;
        if (delivery.finished()) {
            removeFinished(job, delivery);
            return false;
        }
        if (deferred(delivery, now)) return false;
        // Conditional initialization may have returned a row already used by another worker.
        if (delivery.attempts() >= MAX_ATTEMPTS) {
            stop(job, delivery, now, "REVIEW_REQUIRED", "EMAIL_RETRY_WINDOW_EXHAUSTED");
            return false;
        }
        if (quiet(prefs.quietHoursStart(), prefs.quietHoursEnd(), prefs.timezone(), now)) return false;
        try {
            String originalRecipient = json.readTree(delivery.requestJson()).path("to").path(0).asText();
            if (!originalRecipient.equals(ResendSettings.normalizeEmail(user.email()))) {
                stop(job, delivery, now, "SKIPPED", "EMAIL_RECIPIENT_CHANGED");
                return false;
            }
        } catch (java.io.IOException exception) { throw new IllegalStateException("Invalid stored email payload"); }
        Delivery claimed = delivery.change("SENDING", delivery.providerId(), now, now.plusSeconds(60),
                null, delivery.attempts() + 1, delivery.deliveredAt(), null);
        if (!deliveries.replace(delivery, claimed)) return false;
        ResendEmailClient.Result result = client.send(claimed);
        String status = result.providerId() != null ? "SENT" : result.retryable() ? "RETRY" : "FAILED";
        Instant retryAt = result.retryable() ? now.plusSeconds(Math.min(900, 30L << Math.min(5, claimed.attempts()))) : null;
        Delivery completed = claimed.change(status, result.providerId(), now, null, retryAt,
                claimed.attempts(), null, result.failureCode());
        // A webhook may already have advanced the row. Never overwrite it with an older API response.
        if (deliveries.replace(claimed, completed) && completed.finished()) deliveries.remove(job);
        return true;
    }

    private void stop(Job job, Delivery delivery, Instant now, String status, String code) {
        boolean reviewing = "REVIEW_REQUIRED".equals(status);
        if (reviewing) {
            // Preserve discovery if the process stops after the ledger write and before queue cleanup.
            registerReview(job);
        }
        if (delivery == null) {
            delivery = deliveries.initialize(new Delivery(job.key(), status, null, "{}", null,
                    null, null, 0, UUID.randomUUID(), null, code));
        }
        if (delivery == null) return;
        if (delivery.finished()) {
            if (reviewing) deliveries.remove(job);
            else removeFinished(job, delivery);
            return;
        }
        if (deferred(delivery, now)) return;
        if (deliveries.replace(delivery, delivery.change(status, delivery.providerId(),
                delivery.attemptedAt(), null, null, delivery.attempts(), delivery.deliveredAt(), code))) deliveries.remove(job);
    }

    private void removeFinished(Job job, Delivery delivery) {
        if ("REVIEW_REQUIRED".equals(delivery.status())) registerReview(job);
        deliveries.remove(job);
    }

    private void registerReview(Job job) {
        reviews.register(new EmailReviewRepository.Candidate(
                job.createdAt().atOffset(ZoneOffset.UTC).toLocalDate(), job.key()));
    }

    private static boolean deferred(Delivery delivery, Instant now) {
        return (delivery.leaseUntil() != null && delivery.leaseUntil().isAfter(now))
                || (delivery.retryAt() != null && delivery.retryAt().isAfter(now));
    }

    static boolean quiet(String start, String end, String zone, Instant now) {
        if (start == null || start.isBlank() || end == null || end.isBlank()) return false;
        LocalTime from = LocalTime.parse(start), to = LocalTime.parse(end);
        LocalTime current = now.atZone(ZoneId.of(zone)).toLocalTime();
        return from.equals(to) || (from.isBefore(to) ? !current.isBefore(from) && current.isBefore(to)
                : !current.isBefore(from) || current.isBefore(to));
    }
}
