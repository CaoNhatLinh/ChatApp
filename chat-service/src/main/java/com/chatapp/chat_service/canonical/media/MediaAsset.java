package com.chatapp.chat_service.canonical.media;

import java.time.Instant;
import java.util.UUID;

public record MediaAsset(
        UUID assetId,
        UUID ownerId,
        String storageProvider,
        String storageKey,
        String publicUrl,
        String fileName,
        String mimeType,
        long byteSize,
        Integer width,
        Integer height,
        Long durationMs,
        String checksumSha256,
        String uploadStatus,
        String malwareScanStatus,
        String moderationStatus,
        Instant createdAt,
        Instant deletedAt) {
}
