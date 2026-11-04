package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class PublicMessageViewTest {
    @Test void publicJsonHasForwardMarkerButNoPrivateSourceKeys() throws Exception {
        UUID id = UUID.randomUUID();
        var message = new CanonicalMessage(id, "2026-10-20-08:03", id, id, "TEXT", "shared copy", "PLAIN",
                null, null, null, null, null, UUID.randomUUID(), "2026-10-19-08:03", UUID.randomUUID(),
                false, null, null, null, false, false, false, Instant.now(), id, null, null, 0);
        var json = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().valueToTree(message);
        assertThat(json.path("forwarded").asBoolean()).isTrue();
        assertThat(json.has("forwardedFromConversationId")).isFalse();
        assertThat(json.has("forwardedFromMessageBucket")).isFalse();
        assertThat(json.has("forwardedFromMessageId")).isFalse();
        assertThat(message.forwardedFromConversationId()).isNotNull();
    }

    @Test
    void redactsDeletedContentAndReferencesButRetainsIdentity() {
        UUID id = UUID.randomUUID();
        CanonicalMessage retained = new CanonicalMessage(id, "2026-10-03-01:00", id, id, "TEXT",
                "private retained text", "PLAIN", id, id, id, id, id, id, "2026-10-03-00:00", id,
                true, id, Instant.now(), Instant.now(), true, true, true, Instant.now(), id,
                new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.GifReference("GIPHY", "private-id"), "2026-10-03-00:01", 0);
        CanonicalMessage view = PublicMessageView.redact(retained);
        assertThat(view.content()).isEmpty();
        assertThat(view.messageId()).isEqualTo(id);
        assertThat(view.replyToMessageId()).isNull();
        assertThat(view.replyToMessageBucket()).isNull();
        assertThat(view.pollId()).isNull();
        assertThat(view.forwardedFromMessageId()).isNull();
        assertThat(view.hasAttachments()).isFalse();
        assertThat(view.hasMentions()).isFalse();
        assertThat(view.isPinned()).isFalse();
        assertThat(view.gif()).isNull();
        assertThat(retained.content()).isEqualTo("private retained text");
    }
}
