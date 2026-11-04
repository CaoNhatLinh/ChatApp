package com.chatapp.chat_service.canonical.media;

import java.time.Instant;
import java.net.URI;

public record MediaThumbnail(Variant variant, Status status, String url,
                             Integer width, Integer height, Instant createdAt) {
    public MediaThumbnail {
        if (variant == null || status == null || createdAt == null) throw new IllegalArgumentException("invalid thumbnail identity");
        if (status == Status.READY) {
            if (width == null || height == null || width < 1 || height < 1
                    || width > variant.maxEdge() || height > variant.maxEdge()
                    || !hasHttpsUrl(url)) {
                throw new IllegalArgumentException("invalid ready thumbnail");
            }
        } else if (url != null || width != null || height != null) {
            throw new IllegalArgumentException("unavailable thumbnail cannot expose delivery metadata");
        }
    }
    static boolean hasHttpsUrl(String value) {
        if (value == null) return false;
        try {
            URI uri = URI.create(value);
            return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null
                    && uri.getFragment() == null && uri.getPath() != null && !uri.getPath().isBlank() && !"/".equals(uri.getPath());
        } catch (IllegalArgumentException exception) { return false; }
    }
    public enum Variant {
        SMALL(320), MEDIUM(768), LARGE(1280);
        private final int maxEdge;
        Variant(int maxEdge) { this.maxEdge = maxEdge; }
        public int maxEdge() { return maxEdge; }
    }
    public enum Status { READY, FAILED, UNAVAILABLE }
}
