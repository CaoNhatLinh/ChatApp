package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AdminEmailReviewService {
    private final AppAuthorizationService authorization;
    private final EmailReviewRepository reviews;

    public AdminEmailReviewService(AppAuthorizationService authorization, EmailReviewRepository reviews) {
        this.authorization = authorization;
        this.reviews = reviews;
    }

    public Page list(UUID actor, String day, String cursor, int limit) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        if (limit < 1 || limit > 50) throw new BadRequestException("limit must be between 1 and 50");
        LocalDate bucket = day == null ? LocalDate.now(ZoneOffset.UTC) : parseDay(day);
        var candidates = reviews.list(bucket, decode(bucket, cursor), limit + 1);
        boolean hasNext = candidates.size() > limit;
        var page = candidates.subList(0, Math.min(limit, candidates.size()));
        var keys = page.stream().map(EmailReviewRepository.Candidate::key).toList();
        var current = keys.isEmpty() ? Map.<EmailDeliveryRepository.Key, EmailReviewRepository.Review>of()
                : reviews.findAll(keys);
        var items = new ArrayList<Item>();
        for (var key : keys) {
            var row = current.get(key);
            if (row != null) items.add(new Item(key.userId(), key.month(), key.notificationId(),
                    row.attempts(), row.attemptedAt()));
        }
        return new Page(List.copyOf(items), hasNext ? encode(page.get(page.size() - 1)) : null, hasNext);
    }

    private static LocalDate parseDay(String day) {
        try {
            if (!day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || day.startsWith("0000")) {
                throw new BadRequestException("day must use YYYY-MM-DD");
            }
            return LocalDate.parse(day);
        } catch (DateTimeParseException invalid) {
            throw new BadRequestException("day must use YYYY-MM-DD");
        }
    }

    private static EmailReviewRepository.Candidate decode(LocalDate bucket, String cursor) {
        if (cursor == null) return null;
        try {
            if (cursor.length() > 160) throw new IllegalArgumentException();
            var parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
            if (parts.length != 5 || !"email-review-v1".equals(parts[0]) || !bucket.toString().equals(parts[1])) {
                throw new IllegalArgumentException();
            }
            var user = UUID.fromString(parts[2]);
            var notification = UUID.fromString(parts[4]);
            if (!user.toString().equals(parts[2]) || notification.version() != 1 || !notification.toString().equals(parts[4])) {
                throw new IllegalArgumentException();
            }
            var key = new EmailDeliveryRepository.Key(user, EmailHistoryService.validateMonth(parts[3]), notification);
            return new EmailReviewRepository.Candidate(bucket, key);
        } catch (IllegalArgumentException | BadRequestException invalid) {
            throw new BadRequestException("invalid email review cursor");
        }
    }

    private static String encode(EmailReviewRepository.Candidate candidate) {
        var key = candidate.key();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(("email-review-v1|" + candidate.day() + "|"
                + key.userId() + "|" + key.month() + "|" + key.notificationId()).getBytes(StandardCharsets.UTF_8));
    }

    public record Page(List<Item> content, String nextCursor, boolean hasNext) {}
    public record Item(UUID userId, String month, UUID notificationId, int attempts, Instant attemptedAt) {}
}
