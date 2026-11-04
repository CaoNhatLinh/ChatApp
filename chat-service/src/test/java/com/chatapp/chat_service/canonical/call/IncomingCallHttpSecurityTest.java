package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.config.SecurityConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.security.jwt.JwtAuthenticationEntryPoint;
import com.chatapp.chat_service.security.jwt.JwtAuthenticationFilter;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real security chain, signed JWT and actor extraction; incoming discovery is mocked. */
class IncomingCallHttpSecurityTest {
    private static final String PATH = "/api/calls/incoming";
    private final UUID actor = UUID.randomUUID();
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;
    private IncomingCallService calls;
    private UserRepository users;
    private String token;

    @BeforeEach void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(WebTestConfiguration.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        calls = context.getBean(IncomingCallService.class);
        users = context.getBean(UserRepository.class);
        var user = mock(CanonicalUser.class);
        when(user.accountStatus()).thenReturn("ACTIVE");
        when(users.findById(actor)).thenReturn(user);
        token = context.getBean(JwtTokenProvider.class).generateToken("incoming-http-test", actor);
    }

    @AfterEach void close() { context.close(); }

    @Test void anonymousAndInvalidSignatureCannotReachDiscovery() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(get(PATH).header("Authorization", "Bearer invalid-signature"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(calls);
    }

    @Test void signedActorScopesDiscoveryDespiteCallerSuppliedUserParameters() throws Exception {
        UUID forged = UUID.randomUUID();
        when(calls.list(actor, "opaque-cursor", 10))
                .thenReturn(new IncomingCallService.Page(List.of(), "continuation", true));
        mvc.perform(get(PATH).accept(MediaType.APPLICATION_JSON).header("Authorization", "Bearer " + token)
                        .param("cursor", "opaque-cursor").param("limit", "10")
                        .param("userId", forged.toString()).param("calleeId", forged.toString())
                        .param("actor", forged.toString()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(result -> verify(calls).list(actor, "opaque-cursor", 10))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value("continuation"))
                .andExpect(jsonPath("$.hasNext").value(true));
        verifyNoMoreInteractions(calls);
        verify(users, never()).findById(forged);
    }

    @Test void missingAcceptHeaderStillReturnsTheCanonicalJsonPage() throws Exception {
        when(calls.list(actor, null, 25)).thenReturn(new IncomingCallService.Page(List.of(), null, false));
        mvc.perform(get(PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(result -> verify(calls).list(actor, null, 25))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value(nullValue()))
                .andExpect(jsonPath("$.hasNext").value(false));
        verifyNoMoreInteractions(calls);
    }

    @Test void missingOrSuspendedAccountCannotReuseAValidSignedToken() throws Exception {
        when(users.findById(actor)).thenReturn(null);
        mvc.perform(get(PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        var suspended = mock(CanonicalUser.class);
        when(suspended.accountStatus()).thenReturn("SUSPENDED");
        when(users.findById(actor)).thenReturn(suspended);
        mvc.perform(get(PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(calls);
    }

    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    static class WebTestConfiguration implements WebMvcConfigurer {
        @Override public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
            var mapper = new JacksonConfig().objectMapper();
            converters.forEach(converter -> {
                if (converter instanceof MappingJackson2HttpMessageConverter json) json.setObjectMapper(mapper);
            });
        }
        @Bean IncomingCallService calls() { return mock(IncomingCallService.class); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean AppAuthorizationService appAuthorization() { return mock(AppAuthorizationService.class); }
        @Bean JwtTokenProvider tokens() {
            byte[] testKey = new byte[32];
            new SecureRandom().nextBytes(testKey);
            return new JwtTokenProvider(Base64.getEncoder().encodeToString(testKey), 60000);
        }
        @Bean JwtAuthenticationFilter jwtFilter(JwtTokenProvider tokens, AppAuthorizationService auth, UserRepository users) {
            return new JwtAuthenticationFilter(tokens, auth, users);
        }
        @Bean SecurityContextHelper actor() { return new SecurityContextHelper(); }
        @Bean JwtAuthenticationEntryPoint entryPoint() { return new JwtAuthenticationEntryPoint(); }
        @Bean GlobalExceptionHandler errors() { return new GlobalExceptionHandler(); }
        @Bean IncomingCallController controller(IncomingCallService calls, SecurityContextHelper security) {
            return new IncomingCallController(calls, security);
        }
    }
}
