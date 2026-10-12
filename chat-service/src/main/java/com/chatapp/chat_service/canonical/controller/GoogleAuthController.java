package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.auth.GoogleAuthContracts;
import com.chatapp.chat_service.canonical.auth.GoogleAuthService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class GoogleAuthController {
    private final GoogleAuthService googleAuth;
    private final AuthSessionResponseFactory sessions;
    private final SecurityContextHelper securityContext;

    public GoogleAuthController(
            GoogleAuthService googleAuth,
            AuthSessionResponseFactory sessions,
            SecurityContextHelper securityContext) {
        this.googleAuth = googleAuth;
        this.sessions = sessions;
        this.securityContext = securityContext;
    }

    @GetMapping("/providers")
    public ResponseEntity<GoogleAuthContracts.ProviderCapabilities> providers() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(googleAuth.capabilities());
    }

    @PostMapping("/google/exchange")
    public ResponseEntity<GoogleAuthContracts.GoogleExchangeResponse> exchange(
            @Valid @RequestBody GoogleAuthContracts.GoogleTokenRequest request) {
        GoogleAuthContracts.GoogleExchangeResponse response = googleAuth.exchange(request.idToken());
        return withOptionalSession(response, HttpStatus.OK);
    }

    @PostMapping("/google/register")
    public ResponseEntity<GoogleAuthContracts.GoogleExchangeResponse> register(
            @Valid @RequestBody GoogleAuthContracts.GoogleRegistrationRequest request) {
        GoogleAuthContracts.GoogleExchangeResponse response = googleAuth.register(
                request.idToken(), request.username(), request.displayName());
        return withOptionalSession(response, HttpStatus.CREATED);
    }

    @GetMapping("/identities")
    public ResponseEntity<GoogleAuthContracts.ConnectedIdentities> identities() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(googleAuth.connectedIdentities(securityContext.getCurrentUserId()));
    }

    @PostMapping("/identities/google")
    public ResponseEntity<GoogleAuthContracts.ConnectedIdentities> linkGoogle(
            @Valid @RequestBody GoogleAuthContracts.GoogleLinkRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(googleAuth.link(
                        securityContext.getCurrentUserId(), request.idToken(), request.currentPassword()));
    }

    private ResponseEntity<GoogleAuthContracts.GoogleExchangeResponse> withOptionalSession(
            GoogleAuthContracts.GoogleExchangeResponse response, HttpStatus signedInStatus) {
        if (response.session() == null) {
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
        }
        return sessions.authenticated(response, response.session().user().userId(), signedInStatus);
    }
}
