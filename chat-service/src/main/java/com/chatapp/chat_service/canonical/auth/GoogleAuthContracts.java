package com.chatapp.chat_service.canonical.auth;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class GoogleAuthContracts {
    private GoogleAuthContracts() {
    }

    public record ProviderCapabilities(GoogleProvider google) {
    }

    public record GoogleProvider(boolean enabled) {
    }

    public record GoogleTokenRequest(
            @NotBlank @Size(max = 16_384) String idToken) {
    }

    public record GoogleRegistrationRequest(
            @NotBlank @Size(max = 16_384) String idToken,
            @NotBlank @Size(min = 3, max = 32)
            @Pattern(regexp = "^[A-Za-z0-9._-]+$") String username,
            @NotBlank @Size(max = 80) String displayName) {
    }

    public record GoogleLinkRequest(
            @NotBlank @Size(max = 16_384) String idToken,
            @NotBlank @Size(max = 128) String currentPassword) {
    }

    public record ConnectedIdentities(GoogleIdentityStatus google) {
    }

    public record GoogleIdentityStatus(boolean linked, String email) {
    }

    public record GoogleExchangeResponse(
            String status,
            CanonicalApiContracts.AuthResponse session,
            String suggestedDisplayName) {

        public static GoogleExchangeResponse signedIn(CanonicalApiContracts.AuthResponse session) {
            return new GoogleExchangeResponse("SIGNED_IN", session, null);
        }

        public static GoogleExchangeResponse registrationRequired(String suggestedDisplayName) {
            return new GoogleExchangeResponse("REGISTRATION_REQUIRED", null, suggestedDisplayName);
        }
    }
}
