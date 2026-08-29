package com.chatapp.chat_service.canonical.notification;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Set;

/** Canonical validation for user notification preferences. */
public final class NotificationSettingsPolicy {
    public static final Set<String> LEVELS = Set.of("ALL", "MENTIONS", "DIRECT_ONLY", "NONE");
    public static final Set<String> ROOM_LEVELS = Set.of("ALL", "MENTIONS", "NONE");
    public static final Set<String> OVERRIDES = Set.of("INHERIT", "ALL", "MENTIONS", "NONE");
    private static final String CLOCK_PATTERN = "(?:[01]\\d|2[0-3]):[0-5]\\d";

    private NotificationSettingsPolicy() {
    }

    public static String requireLevel(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!LEVELS.contains(normalized)) {
            throw new BadRequestException("globalLevel must be ALL, MENTIONS, DIRECT_ONLY, or NONE");
        }
        return normalized;
    }

    public static String requireRoomLevel(String value) {
        String normalized = normalizeToken(value, "defaultNotificationLevel");
        if (!ROOM_LEVELS.contains(normalized)) {
            throw new BadRequestException("defaultNotificationLevel must be ALL, MENTIONS, or NONE");
        }
        return normalized;
    }

    public static void requireRoomReduction(String previousLevel, String nextLevel) {
        int previousRank = roomRank(requireRoomLevel(previousLevel));
        int nextRank = roomRank(requireRoomLevel(nextLevel));
        if (nextRank < previousRank) {
            throw new ConflictException("room notification default can only be reduced");
        }
    }

    public static String requireOverride(String value) {
        String normalized = normalizeToken(value, "notificationOverride");
        if (!OVERRIDES.contains(normalized)) {
            throw new BadRequestException("notificationOverride must be INHERIT, ALL, MENTIONS, or NONE");
        }
        return normalized;
    }

    private static String normalizeToken(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(field + " is required");
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private static int roomRank(String level) {
        return switch (level) {
            case "ALL" -> 0;
            case "MENTIONS" -> 1;
            case "NONE" -> 2;
            default -> throw new IllegalArgumentException("unsupported room notification level");
        };
    }

    public static Boolean requireBoolean(Boolean value, String field) {
        if (value == null) {
            throw new BadRequestException(field + " is required");
        }
        return value;
    }

    public static String normalizeClock(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (!normalized.matches(CLOCK_PATTERN)) {
            throw new BadRequestException(field + " must use HH:mm");
        }
        return normalized;
    }

    public static String normalizeTimezone(String value) {
        if (value == null || value.isBlank()) {
            return "UTC";
        }
        String normalized = value.trim();
        try {
            ZoneId.of(normalized);
        } catch (DateTimeException exception) {
            throw new BadRequestException("timezone must be a valid IANA time zone");
        }
        return normalized;
    }
}
