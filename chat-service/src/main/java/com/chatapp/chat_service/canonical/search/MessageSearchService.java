package com.chatapp.chat_service.canonical.search;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSearchRequest;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.query.StringQuery;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@ConditionalOnProperty(prefix = "app.integrations.elasticsearch", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MessageSearchService {
    private final ElasticsearchOperations elasticsearch;
    private final ConversationAuthorizationService authorization;
    private final ObjectMapper objectMapper;
    private final MessageRepository messages;

    public MessageSearchService(
            ElasticsearchOperations elasticsearch,
            ConversationAuthorizationService authorization,
            ObjectMapper objectMapper,
            MessageRepository messages) {
        this.elasticsearch = elasticsearch;
        this.authorization = authorization;
        this.objectMapper = objectMapper;
        this.messages = messages;
    }

    public SearchPage search(UUID actorId, MessageSearchRequest request) {
        if (request.conversationId() == null) {
            throw new BadRequestException("conversationId is required for authorized message search");
        }
        authorization.requireMember(request.conversationId(), actorId);
        int limit = request.limit() == null ? 50 : Math.max(1, Math.min(100, request.limit()));

        List<Map<String, Object>> filters = new ArrayList<>();
        filters.add(term("conversationId", request.conversationId().toString()));
        filters.add(term("isDeleted", false));
        addTerm(filters, "senderId", request.senderId());
        addTerm(filters, "replyToSenderId", request.replyToSenderId());
        addTerm(filters, "mentionedUserIds", request.mentionUserId());
        if (StringUtils.hasText(request.messageType())) {
            filters.add(term("messageType", request.messageType().trim().toUpperCase()));
        }
        if (request.hasAttachment() != null) {
            filters.add(term("hasAttachments", request.hasAttachment()));
        }
        if (request.isPinned() != null) {
            filters.add(term("isPinned", request.isPinned()));
        }
        if (request.fromAt() != null || request.toAt() != null) {
            Map<String, Object> bounds = new LinkedHashMap<>();
            if (request.fromAt() != null) bounds.put("gte", request.fromAt().toString());
            if (request.toAt() != null) bounds.put("lte", request.toAt().toString());
            filters.add(Map.of("range", Map.of("createdAt", bounds)));
        }

        Map<String, Object> bool = new LinkedHashMap<>();
        bool.put("filter", filters);
        if (StringUtils.hasText(request.q())) {
            bool.put("must", List.of(Map.of("match", Map.of(
                    "content", Map.of("query", request.q().trim(), "operator", "and")))));
        }

        try {
            StringQuery query = new StringQuery(
                    objectMapper.writeValueAsString(Map.of("bool", bool)),
                    PageRequest.of(0, limit));
            query.addSort(Sort.by(
                    Sort.Order.desc("createdAt"),
                    Sort.Order.asc("id")));
            if (StringUtils.hasText(request.pageCursor())) {
                query.setSearchAfter(decodeCursor(request.pageCursor()));
            }
            var searchHits = elasticsearch.search(query, MessageSearchDocument.class);
            List<SearchHit<MessageSearchDocument>> hits = searchHits.getSearchHits();
            String nextCursor = hits.size() < limit
                    ? null
                    : encodeCursor(hits.get(hits.size() - 1).getSortValues());
            List<SearchResult> visible = new ArrayList<>();
            for (SearchHit<MessageSearchDocument> hit : hits) {
                MessageSearchDocument document = hit.getContent();
                CanonicalMessage current = messages.find(request.conversationId(), document.getMessageBucket(),
                        UUID.fromString(document.getMessageId()));
                // Search is a candidate index, never the authority for retained content.
                if (current == null || Boolean.TRUE.equals(current.isDeleted())) continue;
                if (request.isPinned() != null && !request.isPinned().equals(Boolean.TRUE.equals(current.isPinned()))) continue;
                visible.add(SearchResult.from(current, document.getMentionedUserIds()));
            }
            return new SearchPage(List.copyOf(visible), nextCursor);
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Elasticsearch message search failed", exception);
        }
    }

    private void addTerm(List<Map<String, Object>> filters, String field, UUID value) {
        if (value != null) filters.add(term(field, value.toString()));
    }

    private Map<String, Object> term(String field, Object value) {
        return Map.of("term", Map.of(field, value));
    }

    private String encodeCursor(List<Object> sortValues) throws Exception {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(
                objectMapper.writeValueAsBytes(sortValues));
    }

    private List<Object> decodeCursor(String cursor) {
        try {
            byte[] json = Base64.getUrlDecoder().decode(cursor.getBytes(StandardCharsets.UTF_8));
            return objectMapper.readValue(json, new TypeReference<>() { });
        } catch (Exception exception) {
            throw new BadRequestException("invalid search cursor");
        }
    }

    public record SearchPage(List<SearchResult> content, String nextCursor) {
    }

    public record SearchResult(
            String messageId,
            String conversationId,
            String messageBucket,
            String senderId,
            String replyToSenderId,
            Set<String> mentionedUserIds,
            String messageType,
            String content,
            boolean hasAttachments,
            boolean isPinned,
            boolean isDeleted,
            Instant createdAt) {

        private static SearchResult from(CanonicalMessage message, Set<String> mentionedUserIds) {
            return new SearchResult(
                    message.messageId().toString(),
                    message.conversationId().toString(),
                    message.messageBucket(),
                    message.senderId().toString(),
                    message.replyToSenderId() == null ? null : message.replyToSenderId().toString(),
                    Boolean.TRUE.equals(message.hasMentions()) ? mentionedUserIds : Set.of(),
                    message.messageType(),
                    message.content(),
                    Boolean.TRUE.equals(message.hasAttachments()),
                    Boolean.TRUE.equals(message.isPinned()),
                    false,
                    message.createdAt());
        }
    }
}
