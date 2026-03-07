package com.chatapp.chat_service.security.core;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * ✅ Helper to extract user info from SecurityContext
 * - Support both AppUserPrincipal & UserDetails
 * - Null-safe operations
 */
@Slf4j
@Component
public class SecurityContextHelper {

    /**
     * Get current user ID from SecurityContext
     * @return UUID of authenticated user
     * @throws IllegalStateException if user not authenticated
     */
    public UUID getCurrentUserId() {
        Authentication authentication = getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof AppUserPrincipal) {
            AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
            return principal.getUserId();
        }

        log.warn("⚠️ Could not extract userId from SecurityContext");
        throw new IllegalStateException("User not authenticated or principal is invalid");
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

    /**
     * Get authentication from SecurityContext
     */
    private Authentication getAuthentication() {
        return SecurityContextHolder.getContext().getAuthentication();
    }
}