package com.chatapp.chat_service.canonical.messaging;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

public final class ReportOutboxRoute {
    public static final String VERSION = "sharded-v1";
    public static final int SHARDS = 16;
    static final String PARTITION_PREFIX = "report-decisions-";
    private static final DateTimeFormatter HOURLY = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH").withZone(ZoneOffset.UTC);

    private ReportOutboxRoute() {}

    public static String partition(UUID reportId) {
        return partition(Math.floorMod(reportId.hashCode(), SHARDS));
    }

    public static String partition(int shard) {
        return PARTITION_PREFIX + shard;
    }

    public static String legacyPartition(UUID decisionId) {
        return HOURLY.format(Instant.ofEpochMilli(Uuids.unixTimestamp(decisionId)));
    }
}
