package com.chatapp.chat_service.canonical.search;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageSearchProjectorTest {
    @Mock MessageSearchRepository repository;

    @Test
    void projectsCanonicalKafkaMessageEventWithSearchFilters() throws Exception {
        when(repository.findById(anyString())).thenReturn(Optional.empty());
        MessageSearchProjector projector = new MessageSearchProjector(repository, new ObjectMapper());
        String event = """
                {
                  "eventType":"MESSAGE_SEND",
                  "conversationId":"11111111-1111-1111-1111-111111111111",
                  "payload":{
                    "messageId":"22222222-2222-2222-2222-222222222222",
                    "messageBucket":"2026-07-22-01:03",
                    "senderId":"33333333-3333-3333-3333-333333333333",
                    "messageType":"TEXT",
                    "content":"hello search",
                    "hasAttachments":true,
                    "isPinned":false,
                    "isDeleted":false,
                    "createdAt":"2026-07-22T01:00:00Z",
                    "mentionedUserIds":["44444444-4444-4444-4444-444444444444"]
                  }
                }
                """;

        projector.project(event);

        ArgumentCaptor<MessageSearchDocument> document = ArgumentCaptor.forClass(MessageSearchDocument.class);
        verify(repository).save(document.capture());
        assertThat(document.getValue().getContent()).isEqualTo("hello search");
        assertThat(document.getValue().isHasAttachments()).isTrue();
        assertThat(document.getValue().getMentionedUserIds())
                .containsExactly("44444444-4444-4444-4444-444444444444");
    }
}
