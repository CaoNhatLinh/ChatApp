package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.canonical.media.MediaDeletionRecoveryRepository.Work;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaDeletionRecoveryWorkerTest {
    @Mock MediaDeletionRecoveryRepository recovery;
    @Mock MediaAssetRepository assets;
    @Mock CloudinaryMediaService media;

    private final Work work = work();
    private MediaDeletionRecoveryWorker worker;

    @BeforeEach
    void setUp() {
        worker = new MediaDeletionRecoveryWorker(recovery, assets, media);
    }

    @Test
    void missingAuthorityKeepsWorkWithoutProviderAttempt() {
        assertThat(worker.process(work)).isFalse();

        verify(assets).findById(work.assetId());
        verifyNoInteractions(media, recovery);
    }

    @ParameterizedTest
    @ValueSource(strings = {"READY", "PENDING", "QUARANTINED"})
    void authorityWithoutDeletionClaimKeepsWork(String status) {
        when(assets.findById(work.assetId())).thenReturn(asset(work, status));

        assertThat(worker.process(work)).isFalse();

        verifyNoInteractions(media, recovery);
    }

    @Test
    void ownerMismatchNeverAttemptsDeletionOrRemovesWork() {
        var wrongOwner = new Work(work.assetId(), UUID.randomUUID());
        when(recovery.list(eq(0), isNull(), anyInt())).thenReturn(List.of(work));
        when(assets.findById(work.assetId())).thenReturn(asset(wrongOwner, "DELETING"));

        worker.tick();

        verify(recovery, never()).remove(work);
        verifyNoInteractions(media);
    }

    @Test
    void deletedAuthorityCleansPointerWithoutProviderAttempt() {
        when(assets.findById(work.assetId())).thenReturn(asset(work, "DELETED"));

        assertThat(worker.process(work)).isFalse();

        verify(recovery).remove(work);
        verifyNoInteractions(media);
    }

    @Test
    void completesDeletionBeforeRemovingPointer() {
        var deleting = asset(work, "DELETING");
        when(assets.findById(work.assetId())).thenReturn(deleting);

        assertThat(worker.process(work)).isTrue();

        var ordered = inOrder(assets, media, recovery);
        ordered.verify(assets).findById(work.assetId());
        ordered.verify(media).finishDeletion(deleting);
        ordered.verify(recovery).remove(work);
    }

    @Test
    void failedProviderAttemptKeepsPointerAndResumesPageAfterOtherShards() {
        var sameShard = work();
        var otherShard = work();
        var failed = asset(work, "DELETING");
        var deferred = asset(sameShard, "DELETING");
        var independent = asset(otherShard, "DELETING");
        when(recovery.list(eq(0), isNull(), anyInt())).thenReturn(List.of(work, sameShard));
        when(recovery.list(eq(1), isNull(), anyInt())).thenReturn(List.of(otherShard));
        when(recovery.list(eq(0), eq(work.assetId()), anyInt())).thenReturn(List.of(sameShard));
        when(assets.findById(work.assetId())).thenReturn(failed);
        when(assets.findById(sameShard.assetId())).thenReturn(deferred);
        when(assets.findById(otherShard.assetId())).thenReturn(independent);
        doThrow(new IllegalStateException("provider unavailable")).when(media).finishDeletion(failed);

        worker.tick();

        verify(media).finishDeletion(failed);
        verify(assets, never()).findById(sameShard.assetId());
        verify(recovery, never()).remove(work);

        for (int tick = 0; tick < MediaDeletionRecoveryRepository.SHARDS; tick++) worker.tick();

        var ordered = inOrder(recovery, media);
        ordered.verify(recovery).list(eq(1), isNull(), anyInt());
        ordered.verify(media).finishDeletion(independent);
        ordered.verify(recovery).remove(otherShard);
        ordered.verify(recovery).list(eq(0), eq(work.assetId()), anyInt());
        ordered.verify(media).finishDeletion(deferred);
        ordered.verify(recovery).remove(sameShard);
        verify(recovery, never()).remove(work);
    }

    private static Work work() {
        return new Work(UUID.randomUUID(), UUID.randomUUID());
    }

    private static MediaAsset asset(Work work, String status) {
        return new MediaAsset(work.assetId(), work.ownerId(), "CLOUDINARY",
                "chatapp/" + work.ownerId() + "/" + work.assetId(), null,
                "fixture.png", "image/png", 12, null, null, null, "fixture-checksum",
                status, "PENDING", "PENDING", Instant.EPOCH, null);
    }
}
