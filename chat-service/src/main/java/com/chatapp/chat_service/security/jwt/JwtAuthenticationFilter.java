package com.chatapp.chat_service.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.chatapp.chat_service.auth.service.UserDetailsServiceImpl;
import com.chatapp.chat_service.security.core.AppUserPrincipal;

import java.io.IOException;
import java.util.UUID;

/**
 * ✅ Single JWT Authentication Filter for HTTP Requests
 * - Extract & validate JWT token
 * - Load UserDetails from database
 * - Set SecurityContext for downstream processing
 * - Skip unnecessary endpoints
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/health",
            "/actuator",
            "/ws",
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
            String username = tokenProvider.extractUsername(token);
            UUID userId = tokenProvider.extractUserId(token);

            AppUserPrincipal userPrincipal = (AppUserPrincipal)
                    userDetailsService.loadUserByUsername(username);

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