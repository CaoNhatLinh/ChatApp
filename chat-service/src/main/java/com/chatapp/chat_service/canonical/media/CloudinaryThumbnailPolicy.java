package com.chatapp.chat_service.canonical.media;

import com.cloudinary.Transformation;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static com.chatapp.chat_service.canonical.media.MediaThumbnail.*;

/** Maps synchronous eager responses by transformation identity, never by response order. */
final class CloudinaryThumbnailPolicy {
    private CloudinaryThumbnailPolicy() {}

    static List<String> transformations() {
        return Arrays.stream(Variant.values()).map(CloudinaryThumbnailPolicy::transformation).toList();
    }

    static String transformation(Variant variant) {
        return transformationBuilder(variant).generate();
    }

    static List<Transformation<?>> eagerTransformations() {
        var transformations = new ArrayList<Transformation<?>>();
        for (var variant : Variant.values()) transformations.add(transformationBuilder(variant));
        return List.copyOf(transformations);
    }

    private static Transformation<?> transformationBuilder(Variant variant) {
        return new Transformation<>().width(variant.maxEdge()).height(variant.maxEdge())
                .crop("limit").page(1).fetchFormat("png");
    }

    static List<MediaThumbnail> read(Object eager, String originalUrl, String publicId, Instant now) {
        List<?> entries = eager instanceof List<?> list && list.size() <= Variant.values().length ? list : List.of();
        var thumbnails = new ArrayList<MediaThumbnail>();
        for (var variant : Variant.values()) {
            List<? extends Map<?, ?>> matches = entries.stream().filter(Map.class::isInstance)
                    .map(value -> (Map<?, ?>) value)
                    .filter(row -> transformation(variant).equals(row.get("transformation"))).toList();
            var thumbnail = new MediaThumbnail(variant, Status.UNAVAILABLE, null, null, null, now);
            if (matches.size() == 1) {
                Map<?, ?> row = matches.get(0);
                if (row.containsKey("error") || "failed".equals(row.get("state"))) {
                    thumbnail = new MediaThumbnail(variant, Status.FAILED, null, null, null, now);
                } else if (row.get("state") == null || "complete".equals(row.get("state"))) {
                    Integer width = positiveInteger(row.get("width"));
                    Integer height = positiveInteger(row.get("height"));
                    if (width != null && height != null && width <= variant.maxEdge() && height <= variant.maxEdge()
                            && row.get("secure_url") instanceof String url && sameAsset(url, originalUrl, publicId)) {
                        thumbnail = new MediaThumbnail(variant, Status.READY, url, width, height, now);
                    }
                }
            }
            thumbnails.add(thumbnail);
        }
        return List.copyOf(thumbnails);
    }

    static Integer positiveInteger(Object value) {
        if (!(value instanceof Number number)) return null;
        double numeric = number.doubleValue();
        return Double.isFinite(numeric) && numeric >= 1 && numeric <= Integer.MAX_VALUE && numeric == Math.rint(numeric)
                ? (int) numeric : null;
    }

    private static boolean sameAsset(String url, String originalUrl, String publicId) {
        try {
            if (!MediaThumbnail.hasHttpsUrl(url) || !MediaThumbnail.hasHttpsUrl(originalUrl)) return false;
            URI uri = URI.create(url), original = URI.create(originalUrl);
            int uploadPath = original.getPath().indexOf("/image/upload/");
            return publicId != null && !publicId.isBlank() && uploadPath >= 0
                    && uri.getHost().equalsIgnoreCase(original.getHost()) && uri.getPort() == original.getPort()
                    && uri.getPath().startsWith(original.getPath().substring(0, uploadPath + "/image/upload/".length()))
                    && uri.getPath().endsWith("/" + publicId + ".png");
        } catch (IllegalArgumentException exception) { return false; }
    }
}
