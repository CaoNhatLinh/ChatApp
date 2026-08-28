package com.chatapp.chat_service.canonical.model;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.UUID;

/** Shared bucket format for every table that references a message. */
public final class MessageBucket {
    private static final int SHARD_COUNT = 16;
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH")
            .withZone(ZoneOffset.UTC);

    private MessageBucket() {
    }

    public static String forWrite(Instant occurredAt, UUID stableKey) {
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(stableKey, "stableKey");
        return HOUR.format(occurredAt) + ":" + String.format("%02d", shard(stableKey));
    }

    public static String withTimeAndShard(Instant occurredAt, int shard) {
        return HOUR.format(occurredAt) + ":" + String.format("%02d", Math.floorMod(shard, SHARD_COUNT));
    }

    public static int shard(UUID stableKey) {
        return Math.floorMod(stableKey.hashCode(), SHARD_COUNT);
    }
}
