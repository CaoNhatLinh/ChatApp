package com.chatapp.chat_service.canonical.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Secrets stay server-side. Until email ownership verification exists, recipients are allowlisted. */
@Component
public class ResendSettings {
    final boolean enabled;
    final String apiKey;
    final String from;
    final String webhookSecret;
    final String appUrl;
    final Set<String> recipients;

    public ResendSettings(
            @Value("${app.email.enabled:false}") boolean enabled,
            @Value("${app.email.resend.api-key:}") String apiKey,
            @Value("${app.email.from:Nối <onboarding@resend.dev>}") String from,
            @Value("${app.email.resend.webhook-secret:}") String webhookSecret,
            @Value("${app.public-base-url:http://localhost:3000}") String appUrl,
            @Value("${app.email.allowed-recipients:}") String recipients) {
        this.enabled = enabled;
        this.apiKey = apiKey;
        this.from = from;
        this.webhookSecret = webhookSecret;
        URI uri = URI.create(appUrl);
        if (uri.getHost() == null || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme())
                && Set.of("localhost", "127.0.0.1").contains(uri.getHost())))
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException("APP_PUBLIC_BASE_URL must be HTTPS or HTTP loopback");
        }
        this.appUrl = appUrl.replaceAll("/+$", "");
        this.recipients = Arrays.stream(recipients.split(",")).map(ResendSettings::normalizeEmail)
                .filter(value -> !value.isBlank()).collect(Collectors.toUnmodifiableSet());
        String sender = from.contains("<") && from.endsWith(">")
                ? from.substring(from.lastIndexOf('<') + 1, from.length() - 1) : from;
        if (enabled && (!apiKey.matches("re_[A-Za-z0-9_-]+") || !validAddress(sender)
                || from.contains("\r") || from.contains("\n") || this.recipients.isEmpty()
                || this.recipients.stream().anyMatch(value -> !validAddress(value)))) {
            throw new IllegalArgumentException("Email requires RESEND_API_KEY, EMAIL_FROM and EMAIL_ALLOWED_RECIPIENTS");
        }
        if (!webhookSecret.isBlank()) {
            try {
                if (!webhookSecret.startsWith("whsec_")
                        || java.util.Base64.getDecoder().decode(webhookSecret.substring(6)).length < 16) {
                    throw new IllegalArgumentException();
                }
            } catch (IllegalArgumentException exception) {
                throw new IllegalArgumentException("Invalid RESEND_WEBHOOK_SECRET");
            }
        }
    }

    public boolean enabled() { return enabled; }
    private static boolean validAddress(String value) {
        return value.matches("[^\\s<>@,]+@[^\\s<>@,]+\\.[^\\s<>@,]+");
    }
    boolean allows(String email) { return recipients.contains(normalizeEmail(email)); }
    static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
