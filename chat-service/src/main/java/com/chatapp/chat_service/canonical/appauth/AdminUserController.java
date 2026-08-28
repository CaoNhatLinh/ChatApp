package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users/{userId}")
public class AdminUserController {
    private final AppRoleAdminService users;
    private final SecurityContextHelper securityContext;

    public AdminUserController(AppRoleAdminService users, SecurityContextHelper securityContext) {
        this.users = users;
        this.securityContext = securityContext;
    }

    @PutMapping("/status")
    public AccountStatusResponse updateStatus(
            @PathVariable UUID userId, @RequestBody AccountStatusMutation request) {
        CanonicalUser updated = users.updateAccountStatus(actorId(), userId, request.accountStatus(), request.reason());
        return new AccountStatusResponse(updated.userId(), updated.username(), updated.accountStatus(), updated.updatedAt());
    }

    @GetMapping("/sessions")
    public java.util.List<CanonicalCqlStore.RefreshTokenSessionRow> listSessions(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "50") int limit) {
        return users.listSessions(actorId(), userId, limit);
    }

    @DeleteMapping("/sessions/{tokenId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeSession(
            @PathVariable UUID userId,
            @PathVariable UUID tokenId,
            @RequestParam("reason") String reason) {
        users.revokeSession(actorId(), userId, tokenId, reason);
    }

    @GetMapping("/devices")
    public java.util.List<CanonicalCqlStore.DeviceSessionRow> listDevices(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "50") int limit) {
        return users.listDevices(actorId(), userId, limit);
    }

    @DeleteMapping("/devices/{deviceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeDevice(
            @PathVariable UUID userId,
            @PathVariable UUID deviceId,
            @RequestParam("reason") String reason) {
        users.revokeDevice(actorId(), userId, deviceId, reason);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }

    public record AccountStatusMutation(String accountStatus, String reason) {
    }

    public record AccountStatusResponse(UUID userId, String username, String accountStatus, java.time.Instant updatedAt) {
    }
}
