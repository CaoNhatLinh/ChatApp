package com.chatapp.chat_service.canonical.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record NotificationSettingsRequest(
        @NotBlank @Pattern(regexp = "ALL|MENTIONS|DIRECT_ONLY|NONE") String globalLevel,
        @NotNull Boolean pushEnabled,
        @NotNull Boolean emailEnabled,
        @NotNull Boolean desktopEnabled,
        @NotNull Boolean soundEnabled,
        @Pattern(regexp = "(?:[01]\\d|2[0-3]):[0-5]\\d") String quietHoursStart,
        @Pattern(regexp = "(?:[01]\\d|2[0-3]):[0-5]\\d") String quietHoursEnd,
        @Size(max = 64) String timezone) {
}
