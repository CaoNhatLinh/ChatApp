package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users/{userId}/app-roles")
public class AppRoleAdminController {
    private final AppRoleAdminService roles;
    private final SecurityContextHelper securityContext;

    public AppRoleAdminController(AppRoleAdminService roles, SecurityContextHelper securityContext) {
        this.roles = roles;
        this.securityContext = securityContext;
    }

    @GetMapping
    public List<AppRoleRepository.AppRoleGrant> list(@PathVariable UUID userId) {
        return roles.list(actorId(), userId);
    }

    @PostMapping
    public ResponseEntity<AppRoleRepository.AppRoleGrant> grant(
            @PathVariable UUID userId, @RequestBody RoleMutation request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(roles.grant(actorId(), userId, request.roleCode(), request.expiresAt(), request.reason()));
    }

    @DeleteMapping("/{roleCode}")
    public ResponseEntity<Void> revoke(
            @PathVariable UUID userId,
            @PathVariable String roleCode,
            @RequestBody(required = false) RoleMutation request) {
        roles.revoke(actorId(), userId, roleCode, request == null ? null : request.reason());
        return ResponseEntity.noContent().build();
    }

    private UUID actorId() { return securityContext.getCurrentUserId(); }

    public record RoleMutation(String roleCode, Instant expiresAt, String reason) {
    }

}
