package com.chatapp.chat_service.canonical.device;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record DeviceRegistrationRequest(
        @NotNull UUID deviceId,
        @NotBlank @Pattern(regexp = "WEB|IOS|ANDROID") String platform,
        @NotBlank @Pattern(regexp = "FCM|APNS|WEB_PUSH") String pushProvider,
        @Size(max = 4096) String pushToken,
        @Size(max = 120) String deviceName,
        @Size(max = 50) String appVersion) {
}
