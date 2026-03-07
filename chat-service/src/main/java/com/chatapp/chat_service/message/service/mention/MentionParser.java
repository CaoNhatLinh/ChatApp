package com.chatapp.chat_service.message.service.mention;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class MentionParser {
    private static final Pattern MENTION_PATTERN = Pattern.compile("@\\[(.*?)\\|(.*?)\\]");

    public List<UUID> extractMentionedUserIds(String content) {
        List<UUID> mentioned = new ArrayList<>();
        Matcher matcher = MENTION_PATTERN.matcher(content);
        while (matcher.find()) {
            try {
                mentioned.add(UUID.fromString(matcher.group(2)));
            } catch (IllegalArgumentException ignored) {}
        }
        return mentioned;
    }
}