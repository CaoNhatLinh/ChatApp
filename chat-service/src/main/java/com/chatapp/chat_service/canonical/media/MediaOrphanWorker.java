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
@ConditionalOnProperty(prefix = "app.integrations.cloudinary",
        name = {"enabled", "recover-deletions", "clean-composer-orphans"}, havingValue = "true")
public class MediaOrphanWorker {
    private static final Logger log = LoggerFactory.getLogger(MediaOrphanWorker.class);
    private static final int PAGE_SIZE = 16;
    private final MediaOrphanRepository orphans;
    private final MediaAssetRepository assets;
    private final MediaDeletionRecoveryRepository deletions;
    private final Duration grace;
    private final UUID[] cursors = new UUID[MediaOrphanRepository.SHARDS];
    private int nextShard;

    public MediaOrphanWorker(MediaOrphanRepository orphans, MediaAssetRepository assets,
                            MediaDeletionRecoveryRepository deletions,
                            @Value("${app.integrations.cloudinary.composer-orphan-grace-days:7}") int graceDays) {
        if (graceDays < 1 || graceDays > 365) throw new IllegalArgumentException("orphan grace days must be between 1 and 365");
        this.orphans = orphans;
        this.assets = assets;
        this.deletions = deletions;
        this.grace = Duration.ofDays(graceDays);
    }

    @Scheduled(fixedDelayString = "${app.integrations.cloudinary.orphan-delay-ms:15000}")
    public void tick() {
        int shard = nextShard;
        nextShard = (shard + 1) % cursors.length;
        Instant cutoff = Instant.now().minus(grace);
        try {
            var page = orphans.list(shard, cursors[shard], PAGE_SIZE);
            for (var item : page) {
                cursors[shard] = item.assetId();
                try {
                    process(item, cutoff);
                } catch (RuntimeException failure) {
                    log.warn("Media orphan recovery deferred an item: {}", failure.getClass().getSimpleName());
                }
            }
            if (page.size() < PAGE_SIZE) cursors[shard] = null;
        } catch (RuntimeException failure) {
            log.warn("Media orphan recovery deferred a shard: {}", failure.getClass().getSimpleName());
        }
    }

    void process(MediaOrphanRepository.Work work, Instant cutoff) {
        switch (assets.orphanState(work, cutoff)) {
            case WAITING -> { }
            case DISCARD -> orphans.remove(work);
            case ELIGIBLE -> {
                deletions.register(new MediaDeletionRecoveryRepository.Work(work.assetId(), work.ownerId()));
                if (assets.claimOrphan(work, cutoff)) orphans.remove(work);
            }
        }
    }
}
