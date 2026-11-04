package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.config.SecurityConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.security.jwt.JwtAuthenticationEntryPoint;
import com.chatapp.chat_service.security.jwt.JwtAuthenticationFilter;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EmailHistoryHttpSecurityTest {
    @Test
    void closingReviewUsesSignedActorAndOnlyReturnsReceiptTime() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(WebConfiguration.class);
            context.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            UUID actor = UUID.randomUUID(), target = UUID.randomUUID(), notification = Uuids.timeBased();
            UUID command = UUID.randomUUID();
            String path = "/api/admin/email-review/" + target + "/2026-10/" + notification + "/disposition";
            String body = "{\"commandId\":\"" + command + "\",\"reason\":\"Checked provider history\"}";
            var repository = context.getBean(EmailReviewDispositionRepository.class);
            mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());

            var user = mock(CanonicalUser.class);
            when(user.accountStatus()).thenReturn("ACTIVE");
            when(context.getBean(UserRepository.class).findById(actor)).thenReturn(user);
            String token = context.getBean(JwtTokenProvider.class).generateToken("review-close-test", actor);
            var authorization = context.getBean(AppAuthorizationService.class);
            doThrow(new ForbiddenException("Missing permission")).doNothing()
                    .when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
            mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body).header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());
            verifyNoInteractions(repository);

            var key = new EmailDeliveryRepository.Key(target, "2026-10", notification);
            var saved = new EmailReviewDispositionRepository.Receipt(
                    command, actor, "Checked provider history", Instant.parse("2026-10-02T08:00:00Z"));
            when(repository.find(key)).thenReturn(new EmailReviewDispositionRepository.State("DELIVERED", saved));
            mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.reviewedAt").value(saved.reviewedAt().toString()))
                    .andExpect(jsonPath("$.reason").doesNotExist()).andExpect(jsonPath("$.actorId").doesNotExist());
            verify(repository).find(key);
            verifyNoMoreInteractions(repository);
        }
    }

    @Test
    void reviewQueueIsOperatorOnlyAndUsesExactCandidateKeys() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(WebConfiguration.class);
            context.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            String path = "/api/admin/email-review";
            var reviews = context.getBean(EmailReviewRepository.class);
            mvc.perform(get(path)).andExpect(status().isUnauthorized());

            UUID actor = UUID.randomUUID();
            var user = mock(CanonicalUser.class);
            when(user.accountStatus()).thenReturn("ACTIVE");
            when(context.getBean(UserRepository.class).findById(actor)).thenReturn(user);
            String token = context.getBean(JwtTokenProvider.class).generateToken("review-test", actor);
            var authorization = context.getBean(AppAuthorizationService.class);
            doThrow(new ForbiddenException("Missing permission")).doNothing()
                    .when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
            mvc.perform(get(path).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
            verifyNoInteractions(reviews);

            var day = LocalDate.parse("2026-10-31");
            var key = new EmailDeliveryRepository.Key(UUID.randomUUID(), "2026-11", Uuids.timeBased());
            when(reviews.list(day, null, 21)).thenReturn(List.of(new EmailReviewRepository.Candidate(day, key)));
            when(reviews.findAll(List.of(key))).thenReturn(Map.of(key, new EmailReviewRepository.Review(10, null)));
            mvc.perform(get(path).param("day", day.toString()).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.content[0].userId").value(key.userId().toString()))
                    .andExpect(jsonPath("$.content[0].month").value(key.month()))
                    .andExpect(jsonPath("$.content[0].notificationId").value(key.notificationId().toString()))
                    .andExpect(jsonPath("$.content[0].attempts").value(10))
                    .andExpect(jsonPath("$.hasNext").value(false));
        }
    }

    @Test
    void operatorLookupRequiresExplicitPermissionAndReturnsOnlyOperationalFields() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(WebConfiguration.class);
            context.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            UUID actor = UUID.randomUUID(), target = UUID.randomUUID(), notification = Uuids.timeBased();
            String path = "/api/admin/email-deliveries/" + target + "/2026-10/" + notification;
            var repository = context.getBean(EmailDeliveryRepository.class);
            mvc.perform(get(path)).andExpect(status().isUnauthorized());

            var user = mock(CanonicalUser.class);
            when(user.accountStatus()).thenReturn("ACTIVE");
            when(context.getBean(UserRepository.class).findById(actor)).thenReturn(user);
            String token = context.getBean(JwtTokenProvider.class).generateToken("operator-test", actor);
            var authorization = context.getBean(AppAuthorizationService.class);
            doThrow(new ForbiddenException("Missing permission")).doNothing()
                    .when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
            mvc.perform(get(path).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
            verifyNoInteractions(repository);

            var key = new EmailDeliveryRepository.Key(target, "2026-10", notification);
            when(repository.find(key)).thenReturn(new EmailDeliveryRepository.Delivery(
                    key, "REVIEW_REQUIRED", "private-provider", "private-body", null, null, null,
                    10, UUID.randomUUID(), null, "private-failure"));
            mvc.perform(get(path).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.status").value("REVIEW_REQUIRED")).andExpect(jsonPath("$.attempts").value(10))
                    .andExpect(jsonPath("$.providerId").doesNotExist()).andExpect(jsonPath("$.requestJson").doesNotExist())
                    .andExpect(jsonPath("$.failureCode").doesNotExist());
            verify(repository).find(key);
            verifyNoMoreInteractions(repository);
        }
    }

    @Test
    void requiresAuthenticationAndOnlyReadsSignedInAccount() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(WebConfiguration.class);
            context.refresh();
            var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
            var history = context.getBean(EmailHistoryService.class);
            var users = context.getBean(UserRepository.class);
            String path = "/api/notifications/email-history";
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            verifyNoInteractions(history);

            UUID actor = UUID.randomUUID(), other = UUID.randomUUID();
            var user = mock(CanonicalUser.class);
            when(user.accountStatus()).thenReturn("ACTIVE");
            when(users.findById(actor)).thenReturn(user);
            String token = context.getBean(JwtTokenProvider.class).generateToken("email-history-test", actor);
            var attemptedAt = Instant.parse("2026-10-01T08:00:00Z");
            var item = new EmailHistoryService.Item(UUID.randomUUID(), EmailHistoryService.Status.SENT, attemptedAt, null);
            when(history.list(actor, "2026-10", null, 20))
                    .thenReturn(new EmailHistoryService.Page(List.of(item), null, false));
            mvc.perform(get(path).param("userId", other.toString()).param("month", "2026-10")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.content[0].status").value("SENT"))
                    .andExpect(jsonPath("$.content[0].attemptedAt").value(attemptedAt.toString()))
                    .andExpect(jsonPath("$.content[0].requestJson").doesNotExist())
                    .andExpect(jsonPath("$.content[0].providerId").doesNotExist())
                    .andExpect(jsonPath("$.content[0].failureCode").doesNotExist());
            verify(history).list(actor, "2026-10", null, 20);
            verifyNoMoreInteractions(history);
            verify(users, never()).findById(other);
        }
    }

    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    static class WebConfiguration implements WebMvcConfigurer {
        @Override public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
            var mapper = new JacksonConfig().objectMapper();
            converters.forEach(converter -> {
                if (converter instanceof MappingJackson2HttpMessageConverter json) json.setObjectMapper(mapper);
            });
        }
        @Bean EmailHistoryService history() { return mock(EmailHistoryService.class); }
        @Bean EmailDeliveryRepository deliveries() { return mock(EmailDeliveryRepository.class); }
        @Bean EmailReviewRepository reviews() { return mock(EmailReviewRepository.class); }
        @Bean EmailReviewDispositionRepository dispositions() { return mock(EmailReviewDispositionRepository.class); }
        @Bean GlobalExceptionHandler errors() { return new GlobalExceptionHandler(); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean AppAuthorizationService appAuthorization() { return mock(AppAuthorizationService.class); }
        @Bean JwtTokenProvider tokens() {
            byte[] bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
            return new JwtTokenProvider(Base64.getEncoder().encodeToString(bytes), 60_000);
        }
        @Bean JwtAuthenticationFilter filter(JwtTokenProvider tokens, AppAuthorizationService auth, UserRepository users) {
            return new JwtAuthenticationFilter(tokens, auth, users);
        }
        @Bean SecurityContextHelper actor() { return new SecurityContextHelper(); }
        @Bean JwtAuthenticationEntryPoint entryPoint() { return new JwtAuthenticationEntryPoint(); }
        @Bean EmailHistoryController controller(EmailHistoryService history, SecurityContextHelper actor) {
            return new EmailHistoryController(history, actor);
        }
        @Bean AdminEmailDeliveryController adminController(
                AppAuthorizationService authorization, EmailDeliveryRepository deliveries, SecurityContextHelper actor) {
            return new AdminEmailDeliveryController(new AdminEmailDeliveryService(authorization, deliveries), actor);
        }
        @Bean AdminEmailReviewController reviewController(
                AppAuthorizationService authorization, EmailReviewRepository reviews,
                EmailReviewDispositionRepository dispositions, SecurityContextHelper actor) {
            return new AdminEmailReviewController(new AdminEmailReviewService(authorization, reviews),
                    new AdminEmailReviewDispositionService(authorization, dispositions), actor);
        }
    }
}
