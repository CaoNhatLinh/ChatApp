package com.chatapp.chat_service.canonical.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Component
@ConditionalOnProperty(prefix = "app.integrations.elasticsearch", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MessageSearchProjector {
    private final MessageSearchRepository repository;
    private final ObjectMapper objectMapper;

    public MessageSearchProjector(MessageSearchRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = "${app.kafka.topics.domain-events}",
            groupId = "${spring.kafka.consumer.group-id:chat-service}-message-search-v1")
    public void project(String json) throws Exception {
        JsonNode event = objectMapper.readTree(json);
        String eventType = text(event, "eventType");
        if (!Set.of("MESSAGE_SEND", "MESSAGE_EDIT", "MESSAGE_DELETE", "MESSAGE_PIN", "MESSAGE_UNPIN").contains(eventType)) {
            return;
        }
        JsonNode payload = event.path("payload");
        String conversationId = text(event, "conversationId");
        String messageId = text(payload, "messageId");
        String id = conversationId + ":" + text(payload, "messageBucket") + ":" + messageId;
        JsonNode revision = payload.get("revision");
        if (revision == null || !revision.isIntegralNumber() || !revision.canConvertToInt() || revision.intValue() < 0) {
            throw new IllegalArgumentException("Canonical message revision is required");
        }
        MessageSearchDocument document = new MessageSearchDocument();
        document.setRevision(revision.intValue());
        boolean pinEvent = Set.of("MESSAGE_PIN", "MESSAGE_UNPIN").contains(eventType);
        if (pinEvent) {
            var pinRevision = payload.get("pinRevision");
            if (pinRevision == null || !pinRevision.isTextual() || !pinRevision.asText().matches("[1-9][0-9]{0,18}")) {
                throw new IllegalArgumentException("Canonical pin revision is required");
            }
            document.setPinRevision(Long.parseLong(pinRevision.asText()));
        }
        document.setId(id);
        document.setConversationId(conversationId);
        document.setMessageId(messageId);
        document.setMessageBucket(text(payload, "messageBucket"));
        document.setSenderId(text(payload, "senderId"));
        document.setReplyToSenderId(nullableText(payload, "replyToSenderId"));
        document.setMessageType(text(payload, "messageType"));
        document.setContent(nullableText(payload, "content"));
        document.setHasAttachments(payload.path("hasAttachments").asBoolean(false));
        document.setPinned(payload.path("isPinned").asBoolean(false));
        document.setDeleted(payload.path("isDeleted").asBoolean(false));
        document.setCreatedAt(Instant.parse(text(payload, "createdAt")));
        if (payload.has("mentionedUserIds")) {
            Set<String> mentions = new HashSet<>();
            payload.path("mentionedUserIds").forEach(node -> mentions.add(node.asText()));
            document.setMentionedUserIds(mentions);
        }
        repository.upsertSnapshot(document, payload.has("mentionedUserIds"), pinEvent);
    }

    private static String text(JsonNode node, String field) {
        String value = nullableText(node, field);
        if (value == null) {
            throw new IllegalArgumentException("Missing event field: " + field);
        }
        return value;
    }

    private static String nullableText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
}
