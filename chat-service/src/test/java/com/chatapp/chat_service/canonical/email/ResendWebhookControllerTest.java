package com.chatapp.chat_service.canonical.email;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ResendWebhookControllerTest {
    final ObjectMapper json = new ObjectMapper();
    final EmailDeliveryRepository repository = mock(EmailDeliveryRepository.class);
    final Key key = new Key(UUID.randomUUID(), "2026-10", Uuids.timeBased());
    final String providerId = UUID.randomUUID().toString();
    final String secret = "whsec_" + Base64.getEncoder().encodeToString("test-secret-32-bytes-012345678901".getBytes(StandardCharsets.UTF_8));
    final ResendSettings settings = new ResendSettings(false, "", "Nối <onboarding@resend.dev>", secret, "http://localhost:3000", "");
    MockMvc mvc;

    @BeforeEach void setup() { mvc = MockMvcBuilders.standaloneSetup(new ResendWebhookController(settings, repository, json)).build(); }
    Delivery delivery(String state) {
        return new Delivery(key, state, "SENDING".equals(state) ? null : providerId,
                "{\"to\":[\"owner@example.com\"]}", Instant.now(), null, null, 1, UUID.randomUUID(), null, null);
    }
    String payload(String type, String emailId) throws Exception {
        return json.writeValueAsString(Map.of("type", type, "created_at", Instant.now().toString(),
                "data", Map.of("email_id", emailId, "to", new String[]{"owner@example.com"}, "tags", Map.of(
                        "noi_user", key.userId().toString(), "noi_month", key.month(), "noi_notification", key.notificationId().toString()))));
    }
    MockHttpServletRequestBuilder signed(String body) throws Exception {
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(Base64.getDecoder().decode(secret.substring(6)), "HmacSHA256"));
        String signature = Base64.getEncoder().encodeToString(mac.doFinal(("msg_test." + timestamp + "." + body).getBytes(StandardCharsets.UTF_8)));
        return post("/api/webhooks/resend").contentType("application/json").content(body)
                .header("svix-id", "msg_test").header("svix-timestamp", timestamp).header("svix-signature", "v1," + signature);
    }
    @Test void rejectsUnsignedAndOversizedPayloadBeforePersistence() throws Exception {
        mvc.perform(post("/api/webhooks/resend").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/webhooks/resend").contentType("application/json").content("x".repeat(65537))).andExpect(status().isPayloadTooLarge());
        verifyNoInteractions(repository);
    }
    @Test void webhookCanFinishBeforeSendResponseIsPersisted() throws Exception {
        when(repository.find(key)).thenReturn(delivery("SENDING"));
        when(repository.replace(any(), any())).thenReturn(true);
        mvc.perform(signed(payload("email.delivered", providerId))).andExpect(status().isNoContent());
        verify(repository).replace(any(), argThat(next -> "DELIVERED".equals(next.status())
                && providerId.equals(next.providerId()) && next.deliveredAt() != null));
    }
    @Test void replayAndOutOfOrderSentCannotDowngradeDelivery() throws Exception {
        when(repository.find(key)).thenReturn(delivery("DELIVERED"));
        mvc.perform(signed(payload("email.sent", providerId))).andExpect(status().isNoContent());
        mvc.perform(signed(payload("email.delivered", providerId))).andExpect(status().isNoContent());
        verify(repository, never()).replace(any(), any());
    }
    @Test void signedDeliveryCanResolveAnUncertainReviewWithoutResending() throws Exception {
        var review = new Delivery(key, "REVIEW_REQUIRED", null, "{\"to\":[\"owner@example.com\"]}",
                Instant.now(), null, null, 10, UUID.randomUUID(), null, "EMAIL_RETRY_WINDOW_EXHAUSTED");
        when(repository.find(key)).thenReturn(review);
        when(repository.replace(eq(review), any())).thenReturn(true);
        mvc.perform(signed(payload("email.delivered", providerId))).andExpect(status().isNoContent());
        verify(repository).replace(eq(review), argThat(next -> "DELIVERED".equals(next.status())
                && providerId.equals(next.providerId()) && next.deliveredAt() != null && next.attempts() == 10));
    }
    @Test void persistsSuppressionBeforeCompletingBounceAndRepairsOnReplay() throws Exception {
        when(repository.find(key)).thenReturn(delivery("SENT"), delivery("BOUNCED"));
        when(repository.replace(any(), any())).thenReturn(true);
        mvc.perform(signed(payload("email.bounced", providerId))).andExpect(status().isNoContent());
        mvc.perform(signed(payload("email.bounced", providerId))).andExpect(status().isNoContent());
        var order = inOrder(repository);
        order.verify(repository).find(key);
        order.verify(repository).suppress("owner@example.com", "BOUNCED");
        order.verify(repository).replace(any(), any());
        verify(repository, times(2)).suppress("owner@example.com", "BOUNCED");
    }
    @Test void mismatchingProviderIdAndRecipientCannotMutateDelivery() throws Exception {
        when(repository.find(key)).thenReturn(delivery("SENT"));
        mvc.perform(signed(payload("email.delivered", UUID.randomUUID().toString()))).andExpect(status().isBadRequest());
        mvc.perform(signed(payload("email.delivered", providerId).replace("owner@example.com", "other@example.com"))).andExpect(status().isBadRequest());
        verify(repository, never()).replace(any(), any());
    }
    @Test void missingAuthorityAndCasContentionAreRetryableNotAcknowledged() throws Exception {
        mvc.perform(signed(payload("email.sent", providerId))).andExpect(status().isServiceUnavailable());
        when(repository.find(key)).thenReturn(delivery("SENT"));
        mvc.perform(signed(payload("email.delivered", providerId))).andExpect(status().isServiceUnavailable());
    }
    @Test void unsupportedEventsAndOtherApplicationsAreAcknowledgedWithoutWrites() throws Exception {
        mvc.perform(signed("{\"type\":\"email.opened\"}")).andExpect(status().isNoContent());
        mvc.perform(signed("{\"type\":\"email.sent\",\"data\":{}}")).andExpect(status().isNoContent());
        verifyNoInteractions(repository);
    }
    @Test void disabledSecretFailsClosed() throws Exception {
        ResendSettings disabled = new ResendSettings(false, "", "Nối <onboarding@resend.dev>", "", "http://localhost:3000", "");
        var closed = MockMvcBuilders.standaloneSetup(new ResendWebhookController(disabled, repository, json)).build();
        closed.perform(signed("{}")).andExpect(status().isServiceUnavailable());
        verifyNoInteractions(repository);
    }
    @Test void signedMalformedJsonIsRejectedWithoutTouchingPersistence() throws Exception {
        for (String body : new String[]{"", "null", "[]", "{"}) {
            mvc.perform(signed(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(signed(payload("email.sent", providerId).replace("[\"owner@example.com\"]", "\"owner@example.com\"")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }
}
