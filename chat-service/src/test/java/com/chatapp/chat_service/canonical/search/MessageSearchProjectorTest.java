package com.chatapp.chat_service.canonical.search;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageSearchProjectorTest {
    final MessageSearchRepository repository = mock(MessageSearchRepository.class);
    final MessageSearchProjector projector = new MessageSearchProjector(repository, new ObjectMapper());
    String event(String action, String revision) {
        return """
                {"eventType":"%s","conversationId":"room","payload":{
                  "messageId":"message","messageBucket":"2026-10-23-08:00","revision":%s,
                  "senderId":"sender","messageType":"TEXT","content":"snapshot",
                  "pinRevision":"1",
                  "createdAt":"2026-10-23T08:00:00Z","hasAttachments":true,
                  "isPinned":true,"isDeleted":false,"mentionedUserIds":["mentioned"]}}
                """.formatted(action, revision);
    }
    @Test void routesCanonicalSnapshotToAtomicWriterWithoutJavaReadReplace() throws Exception {
        projector.project(event("MESSAGE_SEND", "7"));
        var snapshot = ArgumentCaptor.forClass(MessageSearchDocument.class);
        verify(repository).upsertSnapshot(snapshot.capture(), eq(true), eq(false));
        assertThat(snapshot.getValue().getRevision()).isEqualTo(7);
        assertThat(snapshot.getValue().getContent()).isEqualTo("snapshot");
        assertThat(snapshot.getValue().isHasAttachments()).isTrue();
        assertThat(snapshot.getValue().getMentionedUserIds()).containsExactly("mentioned");
        verifyNoMoreInteractions(repository);
    }
    @Test void pinAndUnpinUseIndependentMetadataPath() throws Exception {
        projector.project(event("MESSAGE_PIN", "2"));
        projector.project(event("MESSAGE_UNPIN", "2").replace("\"isPinned\":true", "\"isPinned\":false")
                .replace("\"pinRevision\":\"1\"", "\"pinRevision\":\"2\""));
        var snapshot = ArgumentCaptor.forClass(MessageSearchDocument.class);
        verify(repository, times(2)).upsertSnapshot(snapshot.capture(), eq(true), eq(true));
        assertThat(snapshot.getAllValues()).extracting(MessageSearchDocument::isPinned).containsExactly(true, false);
        assertThat(snapshot.getAllValues()).extracting(MessageSearchDocument::getPinRevision).containsExactly(1L, 2L);
    }
    @Test void missingMalformedOrOverflowRevisionNeverReachesIndex() {
        for (String revision : new String[]{"null", "-1", "0.5", "2147483648", "\"1\""}) {
            assertThatThrownBy(() -> projector.project(event("MESSAGE_SEND", revision)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> projector.project(event("MESSAGE_SEND", "0").replace("\"revision\":0,", "")))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
    @Test void indexFailureEscapesToKafkaRecoveryRatherThanAcknowledgingSuccess() {
        doThrow(new IllegalStateException("index unavailable")).when(repository).upsertSnapshot(any(), anyBoolean(), anyBoolean());
        assertThatThrownBy(() -> projector.project(event("MESSAGE_DELETE", "3")))
                .isInstanceOf(IllegalStateException.class);
    }
    @Test void ignoresUnrelatedEventsBeforeParsingMessageScope() throws Exception {
        projector.project("{\"eventType\":\"CALL_STARTED\"}");
        verifyNoInteractions(repository);
    }
}
