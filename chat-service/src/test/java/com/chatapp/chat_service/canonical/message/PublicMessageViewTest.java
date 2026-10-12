package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class PublicMessageViewTest {
    @Test
    void redactsDeletedContentAndReferencesButRetainsIdentity() {
        UUID id = UUID.randomUUID();
        CanonicalMessage retained = new CanonicalMessage(id, "2026-10-03-01:00", id, id, "TEXT",
                "private retained text", "PLAIN", id, id, id, id, id, id, "2026-10-03-00:00", id,
                true, id, Instant.now(), Instant.now(), true, true, true, Instant.now(), id);
        CanonicalMessage view = PublicMessageView.redact(retained);
        assertThat(view.content()).isEmpty();
        assertThat(view.messageId()).isEqualTo(id);
        assertThat(view.replyToMessageId()).isNull();
        assertThat(view.pollId()).isNull();
        assertThat(view.forwardedFromMessageId()).isNull();
        assertThat(view.hasAttachments()).isFalse();
        assertThat(view.hasMentions()).isFalse();
        assertThat(view.isPinned()).isFalse();
        assertThat(retained.content()).isEqualTo("private retained text");
    }
}
