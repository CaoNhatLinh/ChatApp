package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.GifReference;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class MessageGifPolicyTest {
    MessageSendRequest request(String type, String content, GifReference gif) {
        return new MessageSendRequest(UUID.randomUUID(), type, content, "PLAIN", null, null, null,
                null, null, null, null, List.of(), Set.of(), false, gif);
    }

    @Test void acceptsOnlyTypedGiphyIdentityWithEmptyPlainContent() {
        assertThatCode(() -> MessageGifPolicy.validate("GIF", request("GIF", "", new GifReference("GIPHY", "abc_123-Z"))))
                .doesNotThrowAnyException();
    }

    @Test void rejectsMissingOrUnknownProviderAndUrlShapedIdentity() {
        for (var gif : new GifReference[] { null, new GifReference("TENOR", "abc"),
                new GifReference("giphy", "abc"), new GifReference("GIPHY", "https://evil.test/x.gif"),
                new GifReference("GIPHY", "../abc"), new GifReference("GIPHY", ""), new GifReference("GIPHY", "a".repeat(129)) }) {
            assertThatThrownBy(() -> MessageGifPolicy.validate("GIF", request("GIF", "", gif)))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Test void rejectsHiddenGifPayloadInOtherMessageTypesAndMixedContent() {
        var gif = new GifReference("GIPHY", "abc");
        for (String type : List.of("TEXT", "STICKER", "IMAGE", "SYSTEM")) {
            assertThatThrownBy(() -> MessageGifPolicy.validate(type, request(type, "", gif))).isInstanceOf(BadRequestException.class);
        }
        assertThatThrownBy(() -> MessageGifPolicy.validate("GIF", request("GIF", "caption", gif))).isInstanceOf(BadRequestException.class);
    }

    @Test void providerIdentityChangesTheIdempotencyFingerprint() {
        var first = request("GIF", "", new GifReference("GIPHY", "first"));
        var second = new MessageSendRequest(first.clientMessageId(), "GIF", "", "PLAIN", null, null, null,
                null, null, null, null, List.of(), Set.of(), false, new GifReference("GIPHY", "second"));
        assertThat(MessageRequestFingerprint.sha256(first)).isEqualTo(MessageRequestFingerprint.sha256(first));
        assertThat(MessageRequestFingerprint.sha256(first)).isNotEqualTo(MessageRequestFingerprint.sha256(second));
    }
}
