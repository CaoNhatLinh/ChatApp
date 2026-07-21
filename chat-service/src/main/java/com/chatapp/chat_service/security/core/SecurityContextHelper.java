package com.chatapp.chat_service.security.core;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Helper to extract user info from SecurityContext
 * - Support AppUserPrincipal, UUID, String UUID and UserDetails.username
 * - Null-safe operations
 */
@Slf4j
@Component
public class SecurityContextHelper {

    /**
     * Get current user ID from SecurityContext
     *
     * @return UUID of authenticated user
     * @throws IllegalStateException if user not authenticated
     */
    public UUID getCurrentUserId() {
        UUID userId = getUserIdFromAuthentication(getAuthentication());
        if (userId != null) {
            return userId;
        }
        log.warn("⚠️ Could not extract userId from SecurityContext");
        throw new IllegalStateException("User not authenticated or principal is invalid");
    }

    public UUID getCurrentUserId(Authentication authentication) {
        UUID userId = getUserIdFromAuthentication(authentication);
        if (userId != null) {
            return userId;
        }
        log.warn("⚠️ Could not extract userId from provided Authentication");
        throw new IllegalStateException("User not authenticated or principal is invalid");
    }

    public boolean hasAuthentication() {
        return isAuthenticated() && getUserIdFromAuthentication(getAuthentication()) != null;
    }

    /**
     * Get current user principal
     */
    public AppUserPrincipal getCurrentUserPrincipal() {
        Authentication authentication = getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof AppUserPrincipal) {
            return (AppUserPrincipal) authentication.getPrincipal();
        }

        log.warn("⚠️ Could not extract user principal from SecurityContext");
        throw new IllegalStateException("User not authenticated or principal is invalid");
    }

    /**
     * Get current username
     */
    public String getCurrentUsername() {
        Authentication authentication = getAuthentication();

        if (authentication != null) {
            return authentication.getName();
        }

        log.warn("⚠️ Could not extract username from SecurityContext");
        throw new IllegalStateException("User not authenticated");
    }

    /**
     * Check if user is authenticated
     */
    public boolean isAuthenticated() {
        Authentication authentication = getAuthentication();
        return authentication != null && authentication.isAuthenticated();
    }

    private UUID getUserIdFromAuthentication(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof AppUserPrincipal appUserPrincipal) {
            return appUserPrincipal.getUserId();
        }

        if (principal instanceof UUID uuid) {
            return uuid;
        }

        if (principal instanceof String value) {
            try {
                return UUID.fromString(value);
            } catch (IllegalArgumentException ex) {
                log.debug("Authentication principal is not a UUID string: {}", value);
            }
        }

        if (principal instanceof UserDetails userDetails && userDetails.getUsername() != null) {
            try {
                return UUID.fromString(userDetails.getUsername());
            } catch (IllegalArgumentException ex) {
                log.debug("Authentication username is not a UUID: {}", userDetails.getUsername());
            }
        }

        String name = authentication.getName();
        if (name != null && !"anonymousUser".equals(name)) {
            try {
                return UUID.fromString(name);
            } catch (IllegalArgumentException ex) {
                log.debug("Authentication name is not a UUID: {}", name);
            }
        }

        return null;
    }

    /**
     * Get authentication from SecurityContext
     */
    private Authentication getAuthentication() {
        return SecurityContextHolder.getContext().getAuthentication();
    }
}
