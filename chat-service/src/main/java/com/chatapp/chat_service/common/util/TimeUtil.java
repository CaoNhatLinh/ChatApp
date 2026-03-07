package com.chatapp.chat_service.common.util;

import java.time.Instant;
import java.time.format.DateTimeFormatter;

public class TimeUtil {
    public static String formatTime(Instant timestamp) {
        return DateTimeFormatter.ISO_INSTANT.format(timestamp);
    }

    public static Instant now() {
        return Instant.now();
    }
}