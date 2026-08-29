package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
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
    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalDeviceController(CanonicalBackendService backend, SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @PostMapping
    public CanonicalCqlStore.DeviceSessionRow register(
            @Valid @RequestBody CanonicalApiContracts.DeviceRegistrationRequest request) {
        return backend.registerDevice(actorId(), request);
    }

    @PostMapping("/{deviceId}/heartbeat")
    public ResponseEntity<Void> heartbeat(@PathVariable UUID deviceId) {
        backend.touchDevice(actorId(), deviceId);
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
