package com.chatapp.chat_service.security.jwt;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;

class JwtAuthenticationFilterTest {

    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
            mock(JwtTokenProvider.class), mock(AppAuthorizationService.class));

    @Test
    void loginAndRegisterArePublicButMeAndLogoutStillRunAuthentication() {
        assertThat(filter.shouldNotFilter(request("/api/auth/login"))).isTrue();
        assertThat(filter.shouldNotFilter(request("/api/auth/register"))).isTrue();
        assertThat(filter.shouldNotFilter(request("/api/auth/me"))).isFalse();
        assertThat(filter.shouldNotFilter(request("/api/auth/logout"))).isFalse();
        assertThat(filter.shouldNotFilter(request("/actuator/metrics"))).isFalse();
    }

    @Test
    void inactiveAccountCannotAuthenticateAnExistingJwt() throws Exception {
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        AppAuthorizationService permissions = mock(AppAuthorizationService.class);
        CanonicalCqlStore users = mock(CanonicalCqlStore.class);
        JwtAuthenticationFilter statusAwareFilter = new JwtAuthenticationFilter(tokens, permissions, users);
        UUID userId = UUID.randomUUID();
        when(tokens.isTokenValid("token")).thenReturn(true);
        when(tokens.extractUserId("token")).thenReturn(userId);
        when(tokens.extractUsername("token")).thenReturn("blocked");
        when(users.findUserById(userId)).thenReturn(new CqlCanonicalRecords.CanonicalUser(
                userId, "blocked", "blocked", "blocked@example.com", "blocked@example.com", "hash",
                "PASSWORD", null, "Blocked", null, "BANNED", Instant.now(), Instant.now(), null));

        var request = request("/api/auth/me");
        request.addHeader("Authorization", "Bearer token");
        var chain = new MockFilterChain();
        statusAwareFilter.doFilter(request, new MockHttpServletResponse(), chain);

        org.assertj.core.api.Assertions.assertThat(chain.getRequest()).isNotNull();
        org.assertj.core.api.Assertions.assertThat(org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication()).isNull();
    }

    private MockHttpServletRequest request(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(uri);
        return request;
    }
}
