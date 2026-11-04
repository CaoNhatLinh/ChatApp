package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.BooleanNode;
import com.fasterxml.jackson.databind.node.IntNode;

/** Allowlist shared by admin validation, recovery traversal and actual consumers. */
public enum SystemSetting {
    COMMUNITY_CREATION_ENABLED("community.creationEnabled", "BOOLEAN", "true", null, null),
    COMMUNITY_DEFAULT_MAX_MEMBERS("community.defaultMaxMembers", "INTEGER", "10000", 2, 100000);

    private final String key, type, defaultValue;
    private final Integer min, max;
    SystemSetting(String key, String type, String defaultValue, Integer min, Integer max) {
        this.key = key; this.type = type; this.defaultValue = defaultValue; this.min = min; this.max = max;
    }
    public String key() { return key; }
    public String type() { return type; }
    public Integer min() { return min; }
    public Integer max() { return max; }
    public JsonNode defaultValue() { return readStored(defaultValue); }

    public static SystemSetting fromKey(String key) {
        for (var definition : values()) if (definition.key.equals(key)) return definition;
        throw new BadRequestException("unknown system setting");
    }

    public String validate(JsonNode value) {
        if (value != null && type.equals("BOOLEAN") && value.isBoolean()) return Boolean.toString(value.booleanValue());
        if (value != null && type.equals("INTEGER") && value.isIntegralNumber() && value.canConvertToInt()
                && value.intValue() >= min && value.intValue() <= max) return Integer.toString(value.intValue());
        throw new BadRequestException("system setting value has an invalid type or range");
    }

    public JsonNode readStored(String value) {
        if (type.equals("BOOLEAN")) {
            if ("true".equals(value)) return BooleanNode.TRUE;
            if ("false".equals(value)) return BooleanNode.FALSE;
        } else {
            try {
                int number = Integer.parseInt(value);
                if (number >= min && number <= max && Integer.toString(number).equals(value)) return IntNode.valueOf(number);
            } catch (NumberFormatException invalid) { /* Fall through to an invariant failure, not a default. */ }
        }
        throw new IllegalStateException("invalid persisted system setting value: " + key);
    }
}
