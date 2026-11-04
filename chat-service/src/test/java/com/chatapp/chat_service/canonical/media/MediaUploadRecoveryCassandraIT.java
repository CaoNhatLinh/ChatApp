package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.canonical.media.MediaUploadRecoveryRepository.Work;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.datastax.oss.driver.api.core.CqlSession;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.CassandraContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
final class MediaUploadRecoveryCassandraIT {
    @Container
    static final CassandraContainer<?> cassandra = new CassandraContainer<>("cassandra:4.1")
            .withEnv("MAX_HEAP_SIZE", "512M").withEnv("HEAP_NEWSIZE", "128M")
            .withStartupTimeout(Duration.ofMinutes(3)).withInitScript("chat_app_complete.cql");

    @Test
    void aFreshReaderPagesAndRemovesOnlyTheExactPersistedPointer() {
        UUID owner = UUID.randomUUID();
        var expected = new ArrayList<Work>();
        Work anotherShard = null;
        for (long number = 1; expected.size() < 101 || anotherShard == null; number++) {
            UUID uploadId = new UUID(0, number);
            UUID assetId = MediaUploadIdentity.of(owner, uploadId).assetId();
            Work work = new Work(assetId, owner, uploadId);
            int shard = Math.floorMod(assetId.hashCode(), MediaUploadRecoveryRepository.SHARDS);
            if (shard == 0 && expected.size() < 101) expected.add(work);
            if (shard == 1) anotherShard = work;
        }

        try (var session = connect()) {
            var writer = new CassandraMediaUploadRecoveryRepository(session);
            expected.forEach(writer::register);
            writer.register(expected.get(0));
            writer.register(anotherShard);
        }

        try (var session = connect()) {
            var reader = new CassandraMediaUploadRecoveryRepository(session);
            List<Work> first = reader.list(0, null, 101);
            assertThat(first).hasSize(100).doesNotHaveDuplicates();
            List<Work> second = reader.list(0, first.get(99).assetId(), 101);
            assertThat(second).hasSize(1).doesNotContainAnyElementsOf(first);
            assertThat(reader.list(0, second.get(0).assetId(), 1)).isEmpty();
            var all = new ArrayList<>(first);
            all.addAll(second);
            assertThat(all).containsExactlyInAnyOrderElementsOf(expected);

            reader.remove(first.get(0));
            reader.remove(first.get(0));
            assertThat(reader.list(0, null, 100)).hasSize(100).doesNotContain(first.get(0));
            assertThat(reader.list(1, null, 1)).containsExactly(anotherShard);
        }
    }

    @Test
    void aFreshReaderFinishesDeletionAndPreservesTheFirstTombstoneAndUploadPointer() {
        UUID owner = UUID.randomUUID();
        UUID uploadId;
        UUID assetId;
        int shard = 2;
        do {
            uploadId = UUID.randomUUID();
            assetId = MediaUploadIdentity.of(owner, uploadId).assetId();
        } while (Math.floorMod(assetId.hashCode(), MediaDeletionRecoveryRepository.SHARDS) != shard);

        var uploadWork = new Work(assetId, owner, uploadId);
        var deletionWork = new MediaDeletionRecoveryRepository.Work(assetId, owner);
        var mapper = new JacksonConfig().objectMapper();
        Instant createdAt = Instant.parse("2026-10-01T10:00:00Z");
        Instant deletedAt = createdAt.plusSeconds(60);
        var readyAsset = new MediaAsset(assetId, owner, "CLOUDINARY", "media/recovery",
                "https://example.com/recovery.webp", "recovery.webp", "image/webp", 100, 32, 32,
                null, null, "READY", "PENDING", "PENDING", createdAt, null);

        try (var session = connect()) {
            new MediaAssetRepository(session, mapper).save(readyAsset);
            new CassandraMediaUploadRecoveryRepository(session).register(uploadWork);
            new CassandraMediaDeletionRecoveryRepository(session).register(deletionWork);
        }

        try (var session = connect()) {
            var assets = new MediaAssetRepository(session, mapper);
            var deletionRecovery = new CassandraMediaDeletionRecoveryRepository(session);
            var uploadRecovery = new CassandraMediaUploadRecoveryRepository(session);
            assertThat(deletionRecovery.list(shard, null, 1)).containsExactly(deletionWork);
            assertThat(assets.claimDeletion(assetId)).isTrue();
            assertThat(assets.findById(assetId).uploadStatus()).isEqualTo("DELETING");

            assertThat(assets.markDeleted(assetId, deletedAt)).isTrue();
            assertThat(assets.markDeleted(assetId, deletedAt.plusSeconds(60))).isFalse();
            MediaAsset deleted = assets.findById(assetId);
            assertThat(deleted.uploadStatus()).isEqualTo("DELETED");
            assertThat(deleted.deletedAt()).isEqualTo(deletedAt);

            deletionRecovery.remove(deletionWork);
            assertThat(deletionRecovery.list(shard, null, 1)).isEmpty();
            assertThat(uploadRecovery.list(shard, null, 1)).containsExactly(uploadWork);
        }
    }

    @Test
    void retainingForMessageHistoryAndClaimingDeletionHaveOneWinnerAcrossSessions() throws Exception {
        UUID assetId = UUID.randomUUID();
        UUID owner = UUID.randomUUID();
        var mapper = new JacksonConfig().objectMapper();
        var ready = new MediaAsset(assetId, owner, "CLOUDINARY", "media/history",
                "https://example.com/history.webp", "history.webp", "image/webp", 100, 32, 32,
                null, null, "READY", "PENDING", "PENDING", Instant.parse("2026-10-01T10:00:00Z"), null);

        try (var messageSession = connect(); var deletionSession = connect()) {
            var messages = new MediaAssetRepository(messageSession, mapper);
            var deletions = new MediaAssetRepository(deletionSession, mapper);
            messages.save(ready);
            var start = new CyclicBarrier(2);
            var executor = Executors.newFixedThreadPool(2);
            try {
                var retain = executor.submit(() -> {
                    start.await(10, TimeUnit.SECONDS);
                    return messages.retainForHistory(assetId);
                });
                var delete = executor.submit(() -> {
                    start.await(10, TimeUnit.SECONDS);
                    return deletions.claimDeletion(assetId);
                });

                boolean retained = retain.get(20, TimeUnit.SECONDS);
                boolean deleting = delete.get(20, TimeUnit.SECONDS);
                assertThat(retained ^ deleting).isTrue();
                assertThat(deletions.findById(assetId).uploadStatus()).isEqualTo(retained ? "READY" : "DELETING");
                if (retained) assertThat(deletions.claimDeletion(assetId)).isFalse();
                else assertThat(messages.retainForHistory(assetId)).isFalse();
            } finally {
                executor.shutdownNow();
            }
        }
    }

    @Test
    void orphanClaimRequiresReadyComposerAuthorityAtTheCutoffAndLosesToRetention() {
        UUID owner = UUID.randomUUID();
        var composer = new MediaOrphanRepository.Work(UUID.randomUUID(), owner);
        var retained = new MediaOrphanRepository.Work(UUID.randomUUID(), owner);
        var legacy = new MediaOrphanRepository.Work(UUID.randomUUID(), owner);
        var pending = new MediaOrphanRepository.Work(UUID.randomUUID(), owner);
        var otherOwner = new MediaOrphanRepository.Work(composer.assetId(), UUID.randomUUID());
        Instant createdAt = Instant.parse("2026-10-01T10:00:00Z");
        Instant tooYoung = createdAt.minusMillis(1);
        var mapper = new JacksonConfig().objectMapper();

        try (var uploadSession = connect(); var cleanupSession = connect()) {
            var uploads = new MediaAssetRepository(uploadSession, mapper);
            var cleanup = new MediaAssetRepository(cleanupSession, mapper);
            for (var item : List.of(composer, retained, legacy, pending)) {
                String purpose = item.equals(legacy) ? null : "COMPOSER";
                assertThat(uploads.claimUpload(orphanAsset(item, createdAt, purpose, false))).isTrue();
                if (!item.equals(pending)) {
                    var receipt = new MediaUploadReceipt(
                            orphanAsset(item, createdAt, purpose, true), UUID.randomUUID(), List.of());
                    assertThat(uploads.completeUpload(receipt)).isTrue();
                }
            }

            assertThat(cleanup.orphanState(composer, tooYoung)).isEqualTo(MediaAssetRepository.OrphanState.WAITING);
            assertThat(cleanup.claimOrphan(composer, tooYoung)).isFalse();
            assertThat(cleanup.orphanState(composer, createdAt)).isEqualTo(MediaAssetRepository.OrphanState.ELIGIBLE);
            assertThat(cleanup.orphanState(otherOwner, createdAt)).isEqualTo(MediaAssetRepository.OrphanState.DISCARD);
            assertThat(cleanup.claimOrphan(otherOwner, createdAt)).isFalse();
            assertThat(cleanup.orphanState(legacy, createdAt)).isEqualTo(MediaAssetRepository.OrphanState.DISCARD);
            assertThat(cleanup.claimOrphan(legacy, createdAt)).isFalse();
            assertThat(cleanup.orphanState(pending, createdAt)).isEqualTo(MediaAssetRepository.OrphanState.WAITING);
            assertThat(cleanup.claimOrphan(pending, createdAt)).isFalse();

            assertThat(cleanup.orphanState(retained, createdAt)).isEqualTo(MediaAssetRepository.OrphanState.ELIGIBLE);
            assertThat(uploads.retainForHistory(retained.assetId())).isTrue();
            assertThat(cleanup.claimOrphan(retained, createdAt)).isFalse();
            assertThat(cleanup.orphanState(retained, createdAt)).isEqualTo(MediaAssetRepository.OrphanState.DISCARD);
            assertThat(cleanup.claimOrphan(composer, createdAt)).isTrue();
            assertThat(uploads.retainForHistory(composer.assetId())).isFalse();
            assertThat(uploads.findById(composer.assetId()).uploadStatus()).isEqualTo("DELETING");
        }
    }

    private static MediaAsset orphanAsset(MediaOrphanRepository.Work work, Instant createdAt, String purpose, boolean ready) {
        String storageKey = "chatapp/" + work.ownerId() + "/" + work.assetId() + ".txt";
        String url = ready ? "https://res.cloudinary.com/fixture/raw/upload/" + storageKey : null;
        return new MediaAsset(work.assetId(), work.ownerId(), "CLOUDINARY", storageKey, url, "draft.txt",
                "text/plain", 12, null, null, null, "a".repeat(64), ready ? "READY" : "PENDING",
                "PENDING", "PENDING", createdAt, null, purpose);
    }

    private static CqlSession connect() {
        return CqlSession.builder().addContactPoint(cassandra.getContactPoint())
                .withLocalDatacenter(cassandra.getLocalDatacenter()).withKeyspace("chat_app").build();
    }
}
