package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.invite.UserJoinRequestRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
public class UserJoinRequestController {
    private final UserJoinRequestRepository requests;
    private final SecurityContextHelper securityContext;

    public UserJoinRequestController(UserJoinRequestRepository requests, SecurityContextHelper securityContext) {
        this.requests = requests;
        this.securityContext = securityContext;
    }

    @GetMapping("/api/me/join-requests")
    public ResponseEntity<UserJoinRequestRepository.Page> list(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") @Min(1) @Max(50) int limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(requests.list(securityContext.getCurrentUserId(), cursor, limit));
    }
}
