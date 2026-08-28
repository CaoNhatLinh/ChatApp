package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/users")
public class CanonicalUserController {
    private final CanonicalBackendService backend;
    private final SecurityContextHelper securityContext;

    public CanonicalUserController(CanonicalBackendService backend, SecurityContextHelper securityContext) {
        this.backend = backend;
        this.securityContext = securityContext;
    }

    @GetMapping("/search")
    public CanonicalApiContracts.UserSearchPage search(
            @RequestParam("q") @Size(min = 2, max = 32) String query,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit,
            @RequestParam(required = false) String cursor) {
        return backend.searchUsers(actorId(), query, limit, cursor);
    }

    @GetMapping("/{userId}")
    public CanonicalApiContracts.PublicUserResponse get(@PathVariable UUID userId) {
        return backend.getPublicUser(actorId(), userId);
    }

    @PatchMapping("/me")
    public CanonicalApiContracts.UserResponse updateMe(
            @RequestBody @Valid CanonicalApiContracts.UpdateProfileRequest request) {
        return backend.updateProfile(actorId(), request);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
