package com.chatapp.chat_service.canonical.settings;

import com.fasterxml.jackson.databind.node.*;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class SystemSettingTest {
    @Test void catalogContainsOnlyRealNonSecretCommunitySettings() {
        assertThat(SystemSetting.values()).hasSize(2);
        assertThat(SystemSetting.fromKey("community.creationEnabled")).isEqualTo(SystemSetting.COMMUNITY_CREATION_ENABLED);
        assertThatThrownBy(() -> SystemSetting.fromKey("resend.apiKey")).isInstanceOf(BadRequestException.class);
    }
    @Test void booleansAreNotCoercedFromStringsOrNumbers() {
        var setting = SystemSetting.COMMUNITY_CREATION_ENABLED;
        assertThat(setting.validate(BooleanNode.FALSE)).isEqualTo("false");
        for (var value : new com.fasterxml.jackson.databind.JsonNode[]{TextNode.valueOf("false"), IntNode.valueOf(0), NullNode.instance}) {
            assertThatThrownBy(() -> setting.validate(value)).isInstanceOf(BadRequestException.class);
        }
    }
    @Test void integersAreStrictlyBoundedAndNeverCoerced() {
        var setting = SystemSetting.COMMUNITY_DEFAULT_MAX_MEMBERS;
        assertThat(setting.validate(IntNode.valueOf(2))).isEqualTo("2");
        assertThat(setting.validate(IntNode.valueOf(100000))).isEqualTo("100000");
        for (var value : new com.fasterxml.jackson.databind.JsonNode[]{IntNode.valueOf(1), IntNode.valueOf(100001),
                TextNode.valueOf("10000"), DoubleNode.valueOf(2.0), BooleanNode.TRUE, LongNode.valueOf(Long.MAX_VALUE)}) {
            assertThatThrownBy(() -> setting.validate(value)).isInstanceOf(BadRequestException.class);
        }
    }
    @Test void invalidStoredValuesAreInvariantFailuresNotDefaults() {
        assertThat(SystemSetting.COMMUNITY_DEFAULT_MAX_MEMBERS.readStored("10000").intValue()).isEqualTo(10000);
        for (var value : new String[]{"01", "", "garbage", "100001"}) {
            assertThatThrownBy(() -> SystemSetting.COMMUNITY_DEFAULT_MAX_MEMBERS.readStored(value)).isInstanceOf(IllegalStateException.class);
        }
        assertThatThrownBy(() -> SystemSetting.COMMUNITY_CREATION_ENABLED.readStored("TRUE")).isInstanceOf(IllegalStateException.class);
    }
}
