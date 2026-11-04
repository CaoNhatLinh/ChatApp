package com.chatapp.chat_service.canonical.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import static com.chatapp.chat_service.canonical.media.MediaThumbnail.*;
import static org.assertj.core.api.Assertions.*;

class CloudinaryThumbnailPolicyTest {
    final Instant now = Instant.parse("2026-10-23T00:00:00Z");
    final String original = "https://res.cloudinary.com/test/image/upload/source.png";

    @Test void requestsThreeBoundedStaticPngTransformations() {
        assertThat(CloudinaryThumbnailPolicy.transformations()).containsExactly(
                "c_limit,f_png,h_320,pg_1,w_320", "c_limit,f_png,h_768,pg_1,w_768", "c_limit,f_png,h_1280,pg_1,w_1280");
    }

    @Test void installedSdkEncodesTheRealEagerRequestWithoutNetworkIo() {
        var sdk = new com.cloudinary.Cloudinary(Map.of("cloud_name", "fixture"));
        var params = sdk.uploader().buildUploadParams(Map.of("eager", CloudinaryThumbnailPolicy.eagerTransformations(), "eager_async", false));
        assertThat(params.get("eager")).isEqualTo(String.join("|", CloudinaryThumbnailPolicy.transformations()));
    }

    @Test void mapsReorderedRealMetadataWithoutInventingDimensionsOrUrls() {
        var result = CloudinaryThumbnailPolicy.read(List.of(ready(Variant.LARGE), ready(Variant.SMALL), ready(Variant.MEDIUM)), original, "source", now);
        assertThat(result).extracting(MediaThumbnail::variant).containsExactly(Variant.SMALL, Variant.MEDIUM, Variant.LARGE);
        assertThat(result).allSatisfy(row -> {
            assertThat(row.status()).isEqualTo(Status.READY);
            assertThat(row.width()).isEqualTo(2);
            assertThat(row.height()).isEqualTo(3);
            assertThat(row.createdAt()).isEqualTo(now);
        });
    }

    @Test void missingOrDuplicateResponseCannotBecomeReady() {
        var rows = CloudinaryThumbnailPolicy.read(List.of(ready(Variant.SMALL), ready(Variant.SMALL)), original, "source", now);
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.status()).isEqualTo(Status.UNAVAILABLE);
            assertThat(row.url()).isNull();
        });
        assertThat(CloudinaryThumbnailPolicy.read(null, original, "source", now)).allMatch(row -> row.status() == Status.UNAVAILABLE);
    }

    @Test void explicitFailureRetainsNoRawProviderError() {
        var result = CloudinaryThumbnailPolicy.read(List.of(Map.of("transformation",
                CloudinaryThumbnailPolicy.transformation(Variant.SMALL), "error", "private provider detail")), original, "source", now);
        assertThat(result.get(0).status()).isEqualTo(Status.FAILED);
        assertThat(result.toString()).doesNotContain("private provider detail");
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://res.cloudinary.com/image.png", "javascript:alert(1)", "https://other.example/image.png",
            "https://user@res.cloudinary.com/image.png", "https://res.cloudinary.com/image.png#fragment",
            "https://res.cloudinary.com:444/image.png", "https://res.cloudinary.com", "/relative.png", "not a url",
            "https://res.cloudinary.com/other/image/upload/source.png", "https://res.cloudinary.com/test/image/upload/other.png",
            "https://res.cloudinary.com/test/image/upload/source.jpg"})
    void rejectsUnsafeOrForeignDeliveryUrls(String url) {
        var row = new HashMap<>(ready(Variant.SMALL));
        row.put("secure_url", url);
        assertThat(CloudinaryThumbnailPolicy.read(List.of(row), original, "source", now).get(0).status()).isEqualTo(Status.UNAVAILABLE);
    }

    @Test void rejectsFractionalNonfiniteMissingOrExcessiveDimensions() {
        for (Object width : new Object[]{0, -1, 321, 1.5, Double.NaN, Double.POSITIVE_INFINITY, Long.MAX_VALUE, "120"}) {
            var row = new HashMap<>(ready(Variant.SMALL));
            row.put("width", width);
            assertThat(CloudinaryThumbnailPolicy.read(List.of(row), original, "source", now).get(0).status()).isEqualTo(Status.UNAVAILABLE);
        }
        var row = new HashMap<>(ready(Variant.SMALL));
        row.remove("height");
        assertThat(CloudinaryThumbnailPolicy.read(List.of(row), original, "source", now).get(0).status()).isEqualTo(Status.UNAVAILABLE);
    }

    @Test void pendingProviderMetadataIsNotACompletedDerivative() {
        var row = new HashMap<>(ready(Variant.SMALL));
        row.put("state", "pending");
        assertThat(CloudinaryThumbnailPolicy.read(List.of(row), original, "source", now).get(0).status()).isEqualTo(Status.UNAVAILABLE);
    }

    @Test void oversizedOrMalformedEagerCollectionsRemainUnavailable() {
        for (Object eager : new Object[]{"invalid", List.of(42), List.of(ready(Variant.SMALL), ready(Variant.MEDIUM),
                ready(Variant.LARGE), ready(Variant.SMALL))}) {
            assertThat(CloudinaryThumbnailPolicy.read(eager, original, "source", now)).allMatch(row -> row.status() == Status.UNAVAILABLE);
        }
    }

    @Test void modelCannotExposeUrlsForFailuresOrInvalidReadyRows() {
        assertThatThrownBy(() -> new MediaThumbnail(Variant.SMALL, Status.FAILED, original, 1, 1, now))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MediaThumbnail(Variant.SMALL, Status.READY, original, 321, 1, now))
                .isInstanceOf(IllegalArgumentException.class);
    }

    static Map<String, Object> ready(Variant variant) {
        return Map.of("transformation", CloudinaryThumbnailPolicy.transformation(variant),
                "secure_url", "https://res.cloudinary.com/test/image/upload/" + variant + "/source.png",
                "width", 2, "height", 3);
    }
}
