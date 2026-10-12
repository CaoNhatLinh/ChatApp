package com.chatapp.chat_service.canonical.search;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSearchRequest;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.Query;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class MessageSearchServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void neverReturnsStaleIndexContentAndSuppressesDeletedPrimary() {
        var elastic = mock(ElasticsearchOperations.class);
        var messages = mock(MessageRepository.class);
        var authorization = mock(ConversationAuthorizationService.class);
        SearchHits<MessageSearchDocument> hits = mock(SearchHits.class);
        SearchHit<MessageSearchDocument> hit = mock(SearchHit.class);
        UUID room = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        String bucket = "2026-10-03-01:00";
        var document = new MessageSearchDocument();
        document.setMessageId(id.toString());
        document.setConversationId(room.toString());
        document.setMessageBucket(bucket);
        document.setContent("retained stale text");
        when(hit.getContent()).thenReturn(document);
        when(hits.getSearchHits()).thenReturn(List.of(hit));
        when(elastic.search(any(Query.class), eq(MessageSearchDocument.class))).thenReturn(hits);
        var service = new MessageSearchService(elastic, authorization, new ObjectMapper(), messages);
        var request = new MessageSearchRequest(room, null, null, null, null, null, null, null, null, null, 50, null);
        UUID actor = UUID.randomUUID();
        when(messages.find(room, bucket, id)).thenReturn(message(room, bucket, id, false));
        assertThat(service.search(actor, request).content()).extracting(MessageSearchService.SearchResult::content)
                .containsExactly("current text");
        when(messages.find(room, bucket, id)).thenReturn(message(room, bucket, id, true));
        assertThat(service.search(actor, request).content()).isEmpty();
        when(messages.find(room, bucket, id)).thenReturn(null);
        assertThat(service.search(actor, request).content()).isEmpty();
    }

    private CanonicalMessage message(UUID room, String bucket, UUID id, boolean deleted) {
        return new CanonicalMessage(room, bucket, id, UUID.randomUUID(), "TEXT", "current text", "PLAIN",
                null, null, null, null, null, null, null, null, deleted, null, null, null,
                false, false, false, Instant.now(), UUID.randomUUID());
    }
}
