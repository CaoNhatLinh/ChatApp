package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class MessageRequestFingerprintTest {
    @Test void stickerIdentityIsPartOfCanonicalMessageFingerprint() {
        UUID client = UUID.randomUUID(), first = UUID.randomUUID(), second = UUID.randomUUID();
        var one = request(client, first);
        assertThat(MessageRequestFingerprint.sha256(one)).isEqualTo(MessageRequestFingerprint.sha256(request(client, first)));
        assertThat(MessageRequestFingerprint.sha256(one)).isNotEqualTo(MessageRequestFingerprint.sha256(request(client, second)));
    }
    private MessageSendRequest request(UUID client, UUID sticker) {
        return new MessageSendRequest(client, "STICKER", "", "PLAIN", null, null, sticker,
                null, null, null, null, List.of(), Set.of(), false, null);
    }
}
