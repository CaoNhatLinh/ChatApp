package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.config.SecurityConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.security.jwt.*;
import java.security.SecureRandom;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Production filter chain and signed actor; history service/storage are controlled. */
class CallHistoryHttpSecurityTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = UUID.randomUUID();
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc; CallHistoryService calls; UserRepository users; String token;
    @BeforeEach void setup() {
        context = new AnnotationConfigWebApplicationContext(); context.setServletContext(new MockServletContext());
        context.register(WebConfiguration.class); context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        calls = context.getBean(CallHistoryService.class); users = context.getBean(UserRepository.class);
        var user = mock(CanonicalUser.class); when(user.accountStatus()).thenReturn("ACTIVE"); when(users.findById(actor)).thenReturn(user);
        token = context.getBean(JwtTokenProvider.class).generateToken("call-history-test", actor);
    }
    @AfterEach void close() { context.close(); }
    @Test void everyHistoryRouteRejectsAnonymousAndBadSignatureBeforeService() throws Exception {
        for (String path : List.of("/api/calls/history", "/api/conversations/" + room + "/calls/history",
                "/api/conversations/" + room + "/calls/" + id + "/history")) {
            mvc.perform(get(path).param("month", "2026-10")).andExpect(status().isUnauthorized());
            mvc.perform(get(path).param("month", "2026-10").header("Authorization", "Bearer bad-signature")).andExpect(status().isUnauthorized());
        }
        verifyNoInteractions(calls);
    }
    @Test void signedActorOwnFeedIgnoresForgedIdentityAndProducesJsonWithoutAcceptHeader() throws Exception {
        UUID forged = UUID.randomUUID();
        when(calls.own(actor, "2026-10", "opaque", 50)).thenReturn(new CallHistoryService.Page(List.of(), null, false));
        mvc.perform(get("/api/calls/history").param("month", "2026-10").param("cursor", "opaque").param("limit", "50")
                        .param("userId", forged.toString()).param("actor", forged.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Cache-Control", "no-store")).andExpect(jsonPath("$.hasNext").value(false));
        verify(calls).own(actor, "2026-10", "opaque", 50); verifyNoMoreInteractions(calls);
        verify(users, never()).findById(forged);
    }
    @Test void roomAndDetailUseSignedActorNotPathOrQueryUser() throws Exception {
        when(calls.conversation(actor, room, "2026-10", null, 25)).thenReturn(new CallHistoryService.Page(List.of(), null, false));
        mvc.perform(get("/api/conversations/" + room + "/calls/history").param("month", "2026-10")
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        doThrow(new com.chatapp.chat_service.common.exception.ForbiddenException("not participant")).when(calls).detail(actor, room, id);
        mvc.perform(get("/api/conversations/" + room + "/calls/" + id + "/history").param("userId", UUID.randomUUID().toString())
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        verify(calls).conversation(actor, room, "2026-10", null, 25); verify(calls).detail(actor, room, id);
    }
    @Test void deletedOrSuspendedAccountCannotReuseSignedToken() throws Exception {
        when(users.findById(actor)).thenReturn(null);
        mvc.perform(get("/api/calls/history").param("month", "2026-10").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        var user = mock(CanonicalUser.class); when(user.accountStatus()).thenReturn("SUSPENDED"); when(users.findById(actor)).thenReturn(user);
        mvc.perform(get("/api/calls/history").param("month", "2026-10").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        verifyNoInteractions(calls);
    }
    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    static class WebConfiguration implements WebMvcConfigurer {
        @Override public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
            var mapper = new JacksonConfig().objectMapper();
            converters.forEach(converter -> { if (converter instanceof MappingJackson2HttpMessageConverter json) json.setObjectMapper(mapper); });
        }
        @Bean CallHistoryService calls() { return mock(CallHistoryService.class); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean AppAuthorizationService appAuthorization() { return mock(AppAuthorizationService.class); }
        @Bean JwtTokenProvider tokens() {
            byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
            return new JwtTokenProvider(Base64.getEncoder().encodeToString(bytes), 60000);
        }
        @Bean JwtAuthenticationFilter filter(JwtTokenProvider tokens, AppAuthorizationService auth, UserRepository users) { return new JwtAuthenticationFilter(tokens, auth, users); }
        @Bean SecurityContextHelper actor() { return new SecurityContextHelper(); }
        @Bean JwtAuthenticationEntryPoint entryPoint() { return new JwtAuthenticationEntryPoint(); }
        @Bean GlobalExceptionHandler errors() { return new GlobalExceptionHandler(); }
        @Bean CallHistoryController controller(CallHistoryService calls, SecurityContextHelper actor) { return new CallHistoryController(calls, actor); }
    }
}
