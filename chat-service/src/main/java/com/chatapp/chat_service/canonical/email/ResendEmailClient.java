package com.chatapp.chat_service.canonical.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/** https://resend.com/docs/api-reference/emails/send-email */
@Component
public class ResendEmailClient {
    private final ResendSettings settings;
    private final ObjectMapper json;
    private final HttpClient http;

    @Autowired public ResendEmailClient(ResendSettings settings, ObjectMapper json) {
        this(settings, json, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }
    ResendEmailClient(ResendSettings settings, ObjectMapper json, HttpClient http) {
        this.settings = settings;
        this.json = json;
        this.http = http;
    }

    record Result(String providerId, boolean retryable, String failureCode) { }

    Result send(EmailDeliveryRepository.Delivery delivery) {
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + settings.apiKey)
                .header("Content-Type", "application/json")
                .header("Idempotency-Key", "noi-email-" + delivery.key().userId() + "-" + delivery.key().notificationId())
                .POST(HttpRequest.BodyPublishers.ofString(delivery.requestJson())).build();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            byte[] bytes;
            try (var stream = response.body()) { bytes = stream.readNBytes(16_385); }
            int status = response.statusCode();
            if (status >= 200 && status < 300 && bytes.length <= 16_384) {
                String id = json.readTree(bytes).path("id").asText();
                UUID.fromString(id);
                return new Result(id, false, null);
            }
            // Never include the provider body in logs/errors: it can contain recipient data.
            boolean concurrent = status == 409 && bytes.length <= 16_384
                    && "concurrent_idempotent_requests".equals(json.readTree(bytes).path("name").asText());
            return new Result(null, concurrent || status == 429 || status == 408 || status >= 500,
                    "RESEND_HTTP_" + status);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return new Result(null, true, "RESEND_INTERRUPTED");
        } catch (Exception exception) {
            // Includes ambiguous success with a malformed response: retry the identical payload/key only.
            return new Result(null, true, "RESEND_UNCERTAIN_RESPONSE");
        }
    }
}
