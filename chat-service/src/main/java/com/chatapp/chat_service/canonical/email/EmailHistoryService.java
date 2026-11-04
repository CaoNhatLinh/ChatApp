package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class EmailHistoryService {
    private static final String CURSOR_VERSION = "email-history-v1";
    private final CassandraEmailHistoryReader reader;

    public EmailHistoryService(CassandraEmailHistoryReader reader) {
        this.reader = reader;
    }

    public Page list(UUID actorId, String month, String cursor, int limit) {
        if (limit < 1 || limit > 50) throw new BadRequestException("limit must be between 1 and 50");
        String bucket = month == null ? YearMonth.now(ZoneOffset.UTC).toString() : validateMonth(month);
        UUID after = decode(actorId, bucket, cursor);
        var candidates = reader.notificationIds(actorId, bucket, after, limit + 1);
        boolean hasNext = candidates.size() > limit;
        var ids = candidates.subList(0, Math.min(candidates.size(), limit));
        var content = ids.isEmpty() ? List.<Item>of() : reader.deliveries(actorId, bucket, ids).stream()
                .map(item -> new Item(item.notificationId(), Status.safe(item.status()),
                        item.attemptedAt(), item.deliveredAt())).toList();
        return new Page(content, hasNext ? encode(actorId, bucket, ids.get(ids.size() - 1)) : null, hasNext);
    }

    static String validateMonth(String month) {
        if (month == null || !month.matches("[0-9]{4}-(0[1-9]|1[0-2])") || month.startsWith("0000")) {
            throw new BadRequestException("month must use YYYY-MM");
        }
        return month;
    }

    private static UUID decode(UUID actorId, String month, String cursor) {
        if (cursor == null) return null;
        try {
            if (cursor.length() > 160) throw new IllegalArgumentException();
            var parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
            if (parts.length != 4 || !CURSOR_VERSION.equals(parts[0]) || !actorId.toString().equals(parts[1])
                    || !month.equals(parts[2])) throw new IllegalArgumentException();
            UUID id = UUID.fromString(parts[3]);
            if (id.version() != 1 || !id.toString().equals(parts[3])) throw new IllegalArgumentException();
            return id;
        } catch (IllegalArgumentException invalid) {
            throw new BadRequestException("invalid email history cursor");
        }
    }

    private static String encode(UUID actorId, String month, UUID after) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(
                (CURSOR_VERSION + "|" + actorId + "|" + month + "|" + after).getBytes(StandardCharsets.UTF_8));
    }

    public record Page(List<Item> content, String nextCursor, boolean hasNext) {}
    public record Item(UUID notificationId, Status status, Instant attemptedAt, Instant deliveredAt) {}
    public enum Status {
        PENDING, SENDING, RETRY, SENT, DELAYED, DELIVERED, FAILED, BOUNCED,
        COMPLAINED, SUPPRESSED, SKIPPED, REVIEW_REQUIRED, UNKNOWN;

        static Status safe(String value) {
            if (value == null) return UNKNOWN;
            try { return valueOf(value); }
            catch (IllegalArgumentException invalid) { return UNKNOWN; }
        }
    }
}
