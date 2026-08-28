package com.chatapp.chat_service.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.chatapp.chat_service.security.core.AppUserPrincipal;
import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * ✅ Single JWT Authentication Filter for HTTP Requests
 * - Extract & validate JWT token
 * - Load UserDetails from database
 * - Set SecurityContext for downstream processing
 * - Skip unnecessary endpoints
 */
@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final AppAuthorizationService appAuthorization;
    private final CanonicalCqlStore users;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, AppAuthorizationService appAuthorization) {
        this(tokenProvider, appAuthorization, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public JwtAuthenticationFilter(
            JwtTokenProvider tokenProvider,
            AppAuthorizationService appAuthorization,
            CanonicalCqlStore users) {
        this.tokenProvider = tokenProvider;
        this.appAuthorization = appAuthorization;
        this.users = users;
    }

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/public/",
            "/api/health",
            "/api/v1/public/",
            "/error"
    };

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String token = extractToken(request);

            if (token != null && tokenProvider.isTokenValid(token)) {
                authenticateRequest(request, token);
                log.debug("✅ JWT token authenticated for request: {}", request.getRequestURI());
            }
        } catch (Exception ex) {
            log.error("❌ Authentication error: {}", ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Load user from token and set SecurityContext
     */
    private void authenticateRequest(HttpServletRequest request, String token) {
        try {
            UUID userId = tokenProvider.extractUserId(token);
            String username = tokenProvider.extractUsername(token);
            if (users != null) {
                var currentUser = users.findUserById(userId);
                if (currentUser == null || !"ACTIVE".equalsIgnoreCase(currentUser.accountStatus())) {
                    log.warn("Rejected JWT for inactive or missing account {}", userId);
                    return;
                }
            }
            AppUserPrincipal userPrincipal = new AppUserPrincipal(
                    userId,
                    username,
                    "",
                    appAuthorization.authorities(userId)
            );

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            userPrincipal,
                            null,
                            userPrincipal.getAuthorities()
                    );

            authentication.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request)
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);

        } catch (Exception ex) {
            log.warn("⚠️ Failed to authenticate JWT token: {}", ex.getMessage());
        }
    }

    /**
     * Extract JWT token from Authorization header
     * Format: "Bearer {token}"
     */
    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    /**
     * Skip filter for public endpoints
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();

        for (String publicEndpoint : PUBLIC_ENDPOINTS) {
            if (path.equals(publicEndpoint) || 
                (publicEndpoint.endsWith("/") && path.startsWith(publicEndpoint)) ||
                path.startsWith(publicEndpoint + "/")) {
                return true;
            }
        }

        return false;
    }
}
