package com.chatapp.chat_service.canonical.email;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ResendSettingsTest {
    @Test void disabledProviderAllowsEmptyCredentialsButNeverAllowsArbitraryRecipients() {
        var settings = new ResendSettings(false, "", "Nối <onboarding@resend.dev>", "", "http://localhost:3000", "");
        assertThat(settings.enabled()).isFalse();
        assertThat(settings.allows("anyone@example.com")).isFalse();
    }
    @Test void enabledProviderRequiresCredentialAndExplicitRecipient() {
        assertThatThrownBy(() -> new ResendSettings(true, "", "Nối <onboarding@resend.dev>", "", "http://localhost:3000", "owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ResendSettings(true, "re_test", "Nối <onboarding@resend.dev>", "", "http://localhost:3000", ""))
                .isInstanceOf(IllegalArgumentException.class);
    }
    @Test void validatesLinkOriginAndSecretWithoutPrintingEither() {
        assertThatThrownBy(() -> new ResendSettings(false, "", "from", "", "http://external.example", ""))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ResendSettings(false, "", "from", "whsec_invalid", "https://example.com", ""))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Invalid RESEND_WEBHOOK_SECRET");
        var settings = new ResendSettings(true, "re_test", "Nối <onboarding@resend.dev>", "", "https://example.com/", " OWNER@example.com ");
        assertThat(settings.allows("Owner@EXAMPLE.com")).isTrue();
        assertThat(settings.appUrl).isEqualTo("https://example.com");
    }
    @Test void rejectsMalformedSenderRecipientAndAuthorizationHeader() {
        assertThatThrownBy(() -> new ResendSettings(true, "re_test\nunsafe", "onboarding@resend.dev", "", "https://example.com", "owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ResendSettings(true, "re_test", "not-an-email", "", "https://example.com", "owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ResendSettings(true, "re_test", "onboarding@resend.dev", "", "https://example.com", "not-an-email"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ResendSettings(false, "", "", "", "https:missing-host", ""))
                .isInstanceOf(IllegalArgumentException.class);
    }
    @Test void propertiesConfigurationPreservesVietnameseSender() throws Exception {
        var loader = new org.springframework.boot.env.PropertiesPropertySourceLoader();
        var application = loader.load("application", new org.springframework.core.io.ClassPathResource("application.properties"));
        assertThat(application.get(0).getProperty("app.email.from"))
                .isEqualTo("${EMAIL_FROM:Nối <onboarding@resend.dev>}");
        var example = loader.load("example", new org.springframework.core.io.FileSystemResource(".env.example"));
        assertThat(example.get(0).getProperty("EMAIL_FROM")).isEqualTo("Nối <onboarding@resend.dev>");
    }
}
