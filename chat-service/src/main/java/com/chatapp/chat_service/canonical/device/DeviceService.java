package com.chatapp.chat_service.canonical.device;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class DeviceService {
    private static final Set<String> PLATFORMS = Set.of("WEB", "IOS", "ANDROID");
    private static final Set<String> PUSH_PROVIDERS = Set.of("FCM", "APNS", "WEB_PUSH");

    private final DeviceRepository devices;

    public DeviceService(DeviceRepository devices) {
        this.devices = devices;
    }

    public DeviceRepository.DeviceSession register(
            UUID actorId, DeviceRegistrationRequest request) {
        requireAuthenticated(actorId);
        if (request == null || request.deviceId() == null) {
            throw new BadRequestException("deviceId is required");
        }
        String platform = requireToken(request.platform(), "platform", PLATFORMS);
        String pushProvider = requireToken(request.pushProvider(), "pushProvider", PUSH_PROVIDERS);
        String pushToken = optionalValue(request.pushToken(), 4096, "pushToken");
        String deviceName = optionalValue(request.deviceName(), 120, "deviceName");
        String appVersion = optionalValue(request.appVersion(), 50, "appVersion");
        return devices.save(
                actorId, request.deviceId(), platform, pushProvider,
                pushToken, deviceName, appVersion, Instant.now());
    }

    public void heartbeat(UUID actorId, UUID deviceId) {
        requireAuthenticated(actorId);
        if (deviceId == null || !devices.touch(actorId, deviceId, Instant.now())) {
            throw new NotFoundException("active device not found");
        }
    }

    private void requireAuthenticated(UUID actorId) {
        if (actorId == null) {
            throw new ForbiddenException("auth required");
        }
    }

    private String requireToken(String value, String field, Set<String> allowed) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BadRequestException(field + " is invalid");
        }
        return normalized;
    }

    private String optionalValue(String value, int maxLength, String field) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > maxLength) {
            throw new BadRequestException(field + " is too long");
        }
        return normalized;
    }
}
