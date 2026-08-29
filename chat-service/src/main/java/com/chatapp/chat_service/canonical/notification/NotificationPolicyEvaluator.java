package com.chatapp.chat_service.canonical.notification;

import java.util.Locale;

/** Evaluates whether a message is eligible for the user's notification inbox. */
public final class NotificationPolicyEvaluator {
    private NotificationPolicyEvaluator() {
    }

    public static boolean allows(
            String globalLevel,
            String roomDefaultLevel,
            String memberOverride,
            String conversationType,
            boolean mention) {
        String global = NotificationSettingsPolicy.requireLevel(globalLevel);
        String roomDefault = NotificationSettingsPolicy.requireRoomLevel(roomDefaultLevel);
        String override = NotificationSettingsPolicy.requireOverride(memberOverride);
        String selectedRoomLevel = "INHERIT".equals(override) ? roomDefault : override;
        String type = conversationType == null ? "" : conversationType.trim().toUpperCase(Locale.ROOT);
        return allowsLevel(global, type, mention) && allowsLevel(selectedRoomLevel, type, mention);
    }

    private static boolean allowsLevel(String level, String conversationType, boolean mention) {
        return switch (level) {
            case "ALL" -> true;
            case "MENTIONS" -> mention;
            case "DIRECT_ONLY" -> "DM".equals(conversationType);
            case "NONE" -> false;
            default -> throw new IllegalArgumentException("unsupported notification level");
        };
    }
}
