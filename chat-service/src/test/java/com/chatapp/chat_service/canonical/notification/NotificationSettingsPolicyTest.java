package com.chatapp.chat_service.canonical.notification;

import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationSettingsPolicyTest {
    @Test
    void acceptsCanonicalLevelsCaseInsensitively() {
        assertThat(NotificationSettingsPolicy.requireLevel(" direct_only ")).isEqualTo("DIRECT_ONLY");
    }

    @Test
    void rejectsUnknownLevelAndMissingChannelValue() {
        assertThatThrownBy(() -> NotificationSettingsPolicy.requireLevel("EVERYTHING"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> NotificationSettingsPolicy.requireBoolean(null, "pushEnabled"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void normalizesOptionalClockAndTimezoneWithoutGuessing() {
        assertThat(NotificationSettingsPolicy.normalizeClock(" 22:05 ", "quietHoursStart"))
                .isEqualTo("22:05");
        assertThat(NotificationSettingsPolicy.normalizeClock("", "quietHoursStart")).isNull();
        assertThat(NotificationSettingsPolicy.normalizeTimezone("Asia/Ho_Chi_Minh"))
                .isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(NotificationSettingsPolicy.normalizeTimezone(null)).isEqualTo("UTC");
        assertThatThrownBy(() -> NotificationSettingsPolicy.normalizeClock("25:00", "quietHoursStart"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> NotificationSettingsPolicy.normalizeTimezone("not/a-zone"))
                .isInstanceOf(BadRequestException.class);
    }
}
