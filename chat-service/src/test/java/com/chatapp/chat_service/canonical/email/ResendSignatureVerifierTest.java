package com.chatapp.chat_service.canonical.email;

import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;

class ResendSignatureVerifierTest {
    private final byte[] body = "{\"event_type\":\"ping\",\"data\":{\"success\":true}}".getBytes(StandardCharsets.UTF_8);
    private final String secret = "whsec_plJ3nmyCDGBKInavdOK15jsl";
    private final String signature = "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=";
    private final Instant now = Instant.ofEpochSecond(1731705121);

    @Test void matchesOfficialSvixVectorAndRotation() {
        assertThat(verify(body, "v1,invalid " + signature, now)).isTrue();
    }
    @Test void rejectsTamperingMissingSignatureAndStaleOrFutureTimestamp() {
        assertThat(verify("{}".getBytes(StandardCharsets.UTF_8), signature, now)).isFalse();
        assertThat(verify(body, null, now)).isFalse();
        assertThat(verify(body, signature, now.plusSeconds(301))).isFalse();
        assertThat(verify(body, signature, now.minusSeconds(301))).isFalse();
    }
    private boolean verify(byte[] payload, String signatures, Instant clock) {
        return ResendSignatureVerifier.verify(payload, "msg_loFOjxBNrRLzqYUf", "1731705121", signatures, secret, clock);
    }
}
