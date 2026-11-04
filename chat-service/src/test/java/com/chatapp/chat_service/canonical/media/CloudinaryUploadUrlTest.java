package com.chatapp.chat_service.canonical.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class CloudinaryUploadUrlTest {
    @Test void acceptsExactSharedCdnOriginalAndOptionalVersion() {
        assertThat(CloudinaryUploadUrl.matches("https://res.cloudinary.com/test/image/upload/chatapp/id.png", "test", "image", "chatapp/id")).isTrue();
        assertThat(CloudinaryUploadUrl.matches("https://res.cloudinary.com/test/video/upload/v123/chatapp/id.mp4", "test", "video", "chatapp/id")).isTrue();
        assertThat(CloudinaryUploadUrl.matches("https://res.cloudinary.com/test/raw/upload/v123/chatapp/id.pdf", "test", "raw", "chatapp/id.pdf")).isTrue();
    }

    @ParameterizedTest @ValueSource(strings = {
            "http://res.cloudinary.com/test/image/upload/chatapp/id.png",
            "https://res.cloudinary.com:444/test/image/upload/chatapp/id.png",
            "https://user@res.cloudinary.com/test/image/upload/chatapp/id.png",
            "https://elsewhere.test/test/image/upload/chatapp/id.png",
            "https://res.cloudinary.com/other/image/upload/chatapp/id.png",
            "https://res.cloudinary.com/test/video/upload/chatapp/id.png",
            "https://res.cloudinary.com/test/image/upload/w_100/chatapp/id.png",
            "https://res.cloudinary.com/test/image/upload/other/chatapp/id.png",
            "https://res.cloudinary.com/test/image/upload/chatapp/id.png/extra",
            "https://res.cloudinary.com/test/image/upload/chatapp/id.png?extra=true",
            "https://res.cloudinary.com/test/image/upload/chatapp/id.png#extra",
            "https://res.cloudinary.com/test/image/upload/chatapp%2Fid.png",
            "not a URL"
    }) void rejectsNonCanonicalOriginal(String url) {
        assertThat(CloudinaryUploadUrl.matches(url, "test", "image", "chatapp/id")).isFalse();
    }

    @Test void noConfiguredTenantAndWrongRawExtensionAreNotTrustworthy() {
        assertThat(CloudinaryUploadUrl.matches("https://res.cloudinary.com/test/image/upload/chatapp/id.png", null, "image", "chatapp/id")).isFalse();
        assertThat(CloudinaryUploadUrl.matches("https://res.cloudinary.com/test/raw/upload/chatapp/id.pdf", "test", "raw", "chatapp/id.txt")).isFalse();
    }
}
