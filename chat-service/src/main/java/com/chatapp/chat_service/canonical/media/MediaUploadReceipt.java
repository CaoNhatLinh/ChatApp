package com.chatapp.chat_service.canonical.media;

import java.util.List;
import java.util.HashSet;
import java.util.Objects;
import java.util.UUID;

public record MediaUploadReceipt(MediaAsset asset, UUID attachmentId, List<MediaThumbnail> thumbnails) {
    public MediaUploadReceipt {
        if (asset == null || asset.assetId() == null || asset.ownerId() == null || attachmentId == null
                || !"READY".equals(asset.uploadStatus()) || asset.deletedAt() != null
                || asset.checksumSha256() == null || !asset.checksumSha256().matches("[a-f0-9]{64}")
                || !MediaThumbnail.hasHttpsUrl(asset.publicUrl()) || asset.createdAt() == null
                || !"CLOUDINARY".equals(asset.storageProvider()) || asset.storageKey() == null || asset.storageKey().isBlank()
                || asset.fileName() == null || asset.fileName().isBlank() || asset.mimeType() == null || asset.mimeType().isBlank()
                || asset.byteSize() < 1 || asset.byteSize() > 10 * 1024 * 1024
                || asset.width() != null && asset.width() < 1 || asset.height() != null && asset.height() < 1
                || asset.durationMs() != null && asset.durationMs() < 0) {
            throw new IllegalArgumentException("invalid upload receipt");
        }
        thumbnails = List.copyOf(thumbnails);
        boolean image = asset.mimeType().startsWith("image/");
        if (image && (asset.width() == null || asset.height() == null
                || asset.width() > ImageUploadPreflight.MAX_EDGE || asset.height() > ImageUploadPreflight.MAX_EDGE
                || (long) asset.width() * asset.height() > ImageUploadPreflight.MAX_PIXELS)) {
            throw new IllegalArgumentException("invalid uploaded image dimensions");
        }
        if (image ? thumbnails.size() != MediaThumbnail.Variant.values().length
                || new HashSet<>(thumbnails.stream().map(MediaThumbnail::variant).toList()).size() != thumbnails.size()
                : !thumbnails.isEmpty()) throw new IllegalArgumentException("invalid upload thumbnail outcomes");
    }

    boolean matches(MediaAsset current) {
        return current != null && asset.assetId().equals(current.assetId()) && asset.ownerId().equals(current.ownerId())
                && asset.storageKey().equals(current.storageKey()) && asset.fileName().equals(current.fileName())
                && asset.mimeType().equals(current.mimeType()) && asset.byteSize() == current.byteSize()
                && asset.checksumSha256().equals(current.checksumSha256()) && Objects.equals(asset.createdAt(), current.createdAt())
                && Objects.equals(asset.storageProvider(), current.storageProvider())
                && asset.publicUrl().equals(current.publicUrl()) && Objects.equals(asset.width(), current.width())
                && Objects.equals(asset.height(), current.height()) && Objects.equals(asset.durationMs(), current.durationMs());
    }
}
