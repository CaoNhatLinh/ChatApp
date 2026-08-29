package com.chatapp.chat_service.canonical.community;

import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;

public final class CommunityDirectoryFilter {

    private CommunityDirectoryFilter() {
    }

    public static String selected(String languageCode, String categoryId, String tag) {
        String language = segment(languageCode, "und");
        if (StringUtils.hasText(tag)) {
            return "language:" + language + ":tag:" + segment(tag, "general");
        }
        if (StringUtils.hasText(categoryId)) {
            return "language:" + language + ":category:" + segment(categoryId, "general");
        }
        return "language:" + language + ":all";
    }

    public static String segment(String value, String defaultValue) {
        if (!StringUtils.hasText(value)) {
            return defaultValue;
        }
        String normalized = Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^\\p{L}\\p{N}]+", "-")
                .replaceAll("(^-+|-+$)", "");
        return normalized.isEmpty() ? defaultValue : normalized;
    }
}
