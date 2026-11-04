package com.chatapp.chat_service.canonical.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ResendEmailClientTest {
    @Test void sendsStableKeyAndUsesServerCredentialOnly() throws Exception {
        HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked") HttpResponse<java.io.InputStream> response = mock(HttpResponse.class);
        String providerId = UUID.randomUUID().toString();
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(new ByteArrayInputStream(("{\"id\":\"" + providerId + "\"}").getBytes(StandardCharsets.UTF_8)));
        when(http.send(any(), any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
            HttpRequest request = call.getArgument(0);
            assertThat(request.uri().toString()).isEqualTo("https://api.resend.com/emails");
            assertThat(request.headers().firstValue("Authorization")).contains("Bearer re_test");
            assertThat(request.headers().firstValue("Idempotency-Key")).hasValueSatisfying(value -> assertThat(value).startsWith("noi-email-"));
            assertThat(request.timeout()).contains(java.time.Duration.ofSeconds(10));
            return response;
        });
        var result = new ResendEmailClient(settings(), new ObjectMapper(), http).send(delivery());
        assertThat(result.providerId()).isEqualTo(providerId);
        assertThat(result.retryable()).isFalse();
    }
    @Test void transientAndPermanentErrorsAreClassifiedWithoutExposingProviderBody() throws Exception {
        for (int code : new int[]{403, 429, 500}) {
            HttpClient http = mock(HttpClient.class);
            @SuppressWarnings("unchecked") HttpResponse<java.io.InputStream> response = mock(HttpResponse.class);
            when(response.statusCode()).thenReturn(code);
            when(response.body()).thenReturn(new ByteArrayInputStream("private recipient and key".getBytes(StandardCharsets.UTF_8)));
            when(http.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn(response);
            var result = new ResendEmailClient(settings(), new ObjectMapper(), http).send(delivery());
            assertThat(result.failureCode()).isEqualTo("RESEND_HTTP_" + code);
            assertThat(result.retryable()).isEqualTo(code != 403);
        }
    }
    ResendSettings settings() { return new ResendSettings(true, "re_test", "Nối <onboarding@resend.dev>", "", "http://localhost:3000", "owner@example.com"); }
    Delivery delivery() { return new Delivery(new Key(UUID.randomUUID(), "2026-10", UUID.randomUUID()), "SENDING", null,
            "{}", null, null, null, 1, UUID.randomUUID(), null, null); }
}
