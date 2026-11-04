package com.chatapp.chat_service.canonical.media;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnProperty(prefix = "app.integrations.cloudinary", name = {"enabled", "recover-deletions"}, havingValue = "true")
public class MediaDeletionRecoveryWorker {
    private static final Logger log = LoggerFactory.getLogger(MediaDeletionRecoveryWorker.class);
    private static final int PAGE_SIZE = 16;
    private final MediaDeletionRecoveryRepository deletions;
    private final MediaAssetRepository assets;
    private final CloudinaryMediaService media;
    private final UUID[] cursors = new UUID[MediaDeletionRecoveryRepository.SHARDS];
    private int nextShard;

    public MediaDeletionRecoveryWorker(MediaDeletionRecoveryRepository deletions, MediaAssetRepository assets,
                                       CloudinaryMediaService media) {
        this.deletions = deletions;
        this.assets = assets;
        this.media = media;
    }

    @Scheduled(fixedDelayString = "${app.integrations.cloudinary.deletion-recovery-delay-ms:15000}")
    public void tick() {
        int shard = nextShard;
        nextShard = (shard + 1) % cursors.length;
        try {
            var work = deletions.list(shard, cursors[shard], PAGE_SIZE);
            for (var item : work) {
                cursors[shard] = item.assetId();
                if (process(item)) return;
            }
            if (work.size() < PAGE_SIZE) cursors[shard] = null;
        } catch (RuntimeException failure) {
            log.warn("Media deletion recovery deferred a shard: {}", failure.getClass().getSimpleName());
        }
    }

    boolean process(MediaDeletionRecoveryRepository.Work work) {
        var asset = assets.findById(work.assetId());
        if (asset == null || !work.assetId().equals(asset.assetId()) || !work.ownerId().equals(asset.ownerId())) return false;
        if ("DELETED".equals(asset.uploadStatus())) deletions.remove(work);
        if (!"DELETING".equals(asset.uploadStatus())) return false;
        try {
            media.finishDeletion(asset);
            deletions.remove(work);
        } catch (RuntimeException failure) {
            log.warn("Media deletion recovery retained work: {}", failure.getClass().getSimpleName());
        }
        return true;
    }
}
