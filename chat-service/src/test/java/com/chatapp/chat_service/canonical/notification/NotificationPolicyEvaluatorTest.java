package com.chatapp.chat_service.canonical.notification;

import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationPolicyEvaluatorTest {
    @Test
    void globalLevelCapsRoomDelivery() {
        assertThat(NotificationPolicyEvaluator.allows("MENTIONS", "ALL", "INHERIT", "GROUP", false))
                .isFalse();
        assertThat(NotificationPolicyEvaluator.allows("MENTIONS", "ALL", "INHERIT", "GROUP", true))
                .isTrue();
    }

    @Test
    void explicitMemberOverrideWinsOverRoomDefault() {
        assertThat(NotificationPolicyEvaluator.allows("ALL", "NONE", "ALL", "GROUP", false))
                .isTrue();
        assertThat(NotificationPolicyEvaluator.allows("ALL", "NONE", "INHERIT", "GROUP", false))
                .isFalse();
    }

    @Test
    void directOnlyGlobalLevelAllowsOnlyDirectConversations() {
        assertThat(NotificationPolicyEvaluator.allows("DIRECT_ONLY", "ALL", "INHERIT", "DM", false))
                .isTrue();
        assertThat(NotificationPolicyEvaluator.allows("DIRECT_ONLY", "ALL", "INHERIT", "GROUP", true))
                .isFalse();
    }

    @Test
    void rejectsUnknownPolicyTokens() {
        assertThatThrownBy(() -> NotificationPolicyEvaluator.allows(
                "ALL", "ALL", "DEFAULT", "GROUP", false))
                .isInstanceOf(BadRequestException.class);
    }
}
