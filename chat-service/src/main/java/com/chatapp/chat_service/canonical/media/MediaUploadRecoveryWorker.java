package com.chatapp.chat_service.canonical.media;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
@ConditionalOnProperty(prefix = "app.integrations.cloudinary", name = "enabled", havingValue = "true")
public class MediaUploadRecoveryWorker {
    private static final Logger log = LoggerFactory.getLogger(MediaUploadRecoveryWorker.class);
    private static final int PAGE_SIZE = 16;
    private static final Duration MIN_PENDING_AGE = Duration.ofMinutes(2);
    private final MediaUploadRecoveryRepository recovery;
    private final MediaAssetRepository assets;
    private final CloudinaryMediaService media;
    private final boolean probePending;
    private final UUID[] cursors = new UUID[MediaUploadRecoveryRepository.SHARDS];
    private int nextShard;

    public MediaUploadRecoveryWorker(MediaUploadRecoveryRepository recovery, MediaAssetRepository assets,
                                     CloudinaryMediaService media,
                                     @Value("${app.integrations.cloudinary.recover-pending:false}") boolean probePending) {
        this.recovery = recovery;
        this.assets = assets;
        this.media = media;
        this.probePending = probePending;
    }

    @Scheduled(fixedDelayString = "${app.integrations.cloudinary.recovery-delay-ms:15000}")
    public void tick() {
        int shard = nextShard;
        nextShard = (shard + 1) % cursors.length;
        try {
            var work = recovery.list(shard, cursors[shard], PAGE_SIZE);
            for (var item : work) {
                cursors[shard] = item.assetId();
                try {
                    if (process(item)) return; // One Admin API attempt per tick, even if the provider fails.
                } catch (RuntimeException failure) {
                    log.warn("Media upload recovery deferred an item: {}", failure.getClass().getSimpleName());
                }
            }
            if (work.size() < PAGE_SIZE) cursors[shard] = null;
        } catch (RuntimeException failure) {
            log.warn("Media upload recovery deferred a shard: {}", failure.getClass().getSimpleName());
        }
    }

    boolean process(MediaUploadRecoveryRepository.Work work) {
        if (!MediaUploadIdentity.of(work.ownerId(), work.uploadId()).assetId().equals(work.assetId())) {
            throw new IllegalStateException("upload recovery pointer does not match its identity");
        }
        var current = assets.findById(work.assetId());
        if (current == null) return false; // Pointer can be visible before the upload claim.
        if (!work.ownerId().equals(current.ownerId())) throw new IllegalStateException("upload recovery owner changed");
        switch (current.uploadStatus()) {
            case "READY" -> {
                media.repairReadyUpload(work, current);
                recovery.remove(work);
            }
            case "PENDING" -> {
                if (probePending && current.createdAt() != null
                        && !current.createdAt().plus(MIN_PENDING_AGE).isAfter(Instant.now())) {
                    try {
                        if (media.recoverPendingUpload(work, current)) recovery.remove(work);
                    } catch (RuntimeException failure) {
                        log.warn("Media pending upload lookup deferred: {}", failure.getClass().getSimpleName());
                    }
                    return true;
                }
            }
            case "DELETED", "QUARANTINED" -> recovery.remove(work);
            default -> { /* Deletion still needs recovery. */ }
        }
        return false;
    }
}
