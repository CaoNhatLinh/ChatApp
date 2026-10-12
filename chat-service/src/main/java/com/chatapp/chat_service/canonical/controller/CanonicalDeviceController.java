package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.device.DeviceService;
import com.chatapp.chat_service.canonical.device.DeviceRegistrationRequest;
import com.chatapp.chat_service.canonical.device.DeviceRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/devices")
public class CanonicalDeviceController {
    private final DeviceService devices;
    private final SecurityContextHelper securityContext;

    public CanonicalDeviceController(DeviceService devices, SecurityContextHelper securityContext) {
        this.devices = devices;
        this.securityContext = securityContext;
    }

    @PostMapping
    public DeviceRepository.DeviceSession register(
            @Valid @RequestBody DeviceRegistrationRequest request) {
        return devices.register(actorId(), request);
    }

    @PostMapping("/{deviceId}/heartbeat")
    public ResponseEntity<Void> heartbeat(@PathVariable UUID deviceId) {
        devices.heartbeat(actorId(), deviceId);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
