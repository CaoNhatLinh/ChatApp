package com.chatapp.chat_service.canonical.email;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import java.io.IOException;
import java.time.Instant;
import java.time.YearMonth;
import java.util.Map;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.email.EmailDeliveryRepository.*;

@RestController
public class ResendWebhookController {
    private static final Map<String, String> EVENTS = Map.of(
            "email.sent", "SENT", "email.delivery_delayed", "DELAYED", "email.delivered", "DELIVERED",
            "email.failed", "FAILED", "email.bounced", "BOUNCED", "email.complained", "COMPLAINED",
            "email.suppressed", "SUPPRESSED");
    private static final Map<String, Integer> RANK = Map.of(
            "PENDING", 0, "SENDING", 0, "RETRY", 0, "SENT", 1, "DELAYED", 2, "DELIVERED", 3,
            "FAILED", 4, "BOUNCED", 5, "COMPLAINED", 6, "SUPPRESSED", 7);
    private final ResendSettings settings;
    private final EmailDeliveryRepository deliveries;
    private final ObjectMapper json;

    public ResendWebhookController(ResendSettings settings, EmailDeliveryRepository deliveries, ObjectMapper json) {
        this.settings = settings;
        this.deliveries = deliveries;
        this.json = json;
    }

    @PostMapping(value = "/api/webhooks/resend", consumes = "application/json")
    public ResponseEntity<Void> receive(HttpServletRequest request) throws IOException {
        if (settings.webhookSecret.isBlank()) return ResponseEntity.status(503).build();
        byte[] body = request.getInputStream().readNBytes(65_537);
        if (body.length > 65_536) return ResponseEntity.status(413).build();
        if (!ResendSignatureVerifier.verify(body, request.getHeader("svix-id"), request.getHeader("svix-timestamp"),
                request.getHeader("svix-signature"), settings.webhookSecret, Instant.now())) {
            return ResponseEntity.status(401).build();
        }
        try {
            JsonNode event = json.readTree(body);
            if (event == null || !event.isObject()) return ResponseEntity.badRequest().build();
            String status = EVENTS.get(event.path("type").asText());
            if (status == null) return ResponseEntity.noContent().build();
            JsonNode data = event.path("data"), tags = data.path("tags");
            if (!tags.has("noi_notification")) return ResponseEntity.noContent().build(); // Other apps may share the account.
            Key key = new Key(UUID.fromString(tags.path("noi_user").asText()),
                    YearMonth.parse(tags.path("noi_month").asText()).toString(),
                    UUID.fromString(tags.path("noi_notification").asText()));
            if (key.notificationId().version() != 1) return ResponseEntity.badRequest().build();
            String providerId = UUID.fromString(data.path("email_id").asText()).toString();
            Instant occurred = Instant.parse(event.path("created_at").asText());
            if (!data.path("to").isArray()) return ResponseEntity.badRequest().build();
            for (int attempt = 0; attempt < 5; attempt++) {
                Delivery previous = deliveries.find(key);
                if (previous == null) return ResponseEntity.status(503).build(); // Do not acknowledge an unpersisted event.
                if (previous.providerId() != null && !providerId.equals(previous.providerId())) return ResponseEntity.badRequest().build();
                String email = json.readTree(previous.requestJson()).path("to").path(0).asText();
                if (email.isBlank()) return ResponseEntity.noContent().build();
                boolean matchingRecipient = false;
                for (JsonNode recipient : data.path("to")) {
                    if (email.equals(ResendSettings.normalizeEmail(recipient.asText()))) matchingRecipient = true;
                }
                if (!matchingRecipient) return ResponseEntity.badRequest().build();
                // Persist suppression first. If the subsequent CAS/ack fails, a replay repairs the delivery row.
                if (java.util.Set.of("BOUNCED", "COMPLAINED", "SUPPRESSED").contains(status)) deliveries.suppress(email, status);
                int previousRank = "REVIEW_REQUIRED".equals(previous.status()) ? 0 : RANK.getOrDefault(previous.status(), 100);
                if (previousRank >= RANK.get(status)) return ResponseEntity.noContent().build();
                Delivery next = previous.change(status, providerId, previous.attemptedAt(), null, null,
                        previous.attempts(), "DELIVERED".equals(status) ? occurred : previous.deliveredAt(),
                        RANK.get(status) >= 4 ? "RESEND_" + status : null);
                if (deliveries.replace(previous, next)) return ResponseEntity.noContent().build();
            }
            return ResponseEntity.status(503).build();
        } catch (java.time.DateTimeException | IllegalArgumentException | com.fasterxml.jackson.core.JsonProcessingException exception) {
            return ResponseEntity.badRequest().build();
        }
    }
}
