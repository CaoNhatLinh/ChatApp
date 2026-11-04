package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.canonical.media.MediaUploadRecoveryRepository.Work;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaUploadRecoveryWorkerTest {
    @Mock MediaUploadRecoveryRepository recovery;
    @Mock MediaAssetRepository assets;
    @Mock CloudinaryMediaService media;

    private final Work work = work();
    private MediaUploadRecoveryWorker worker;

    @BeforeEach
    void setUp() {
        worker = new MediaUploadRecoveryWorker(recovery, assets, media, false);
    }

    @Test
    void keepsWorkWhenUploadAuthorityHasNotBeenCreated() {
        assertThat(worker.process(work)).isFalse();

        verify(assets).findById(work.assetId());
        verifyNoInteractions(recovery, media);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "DELETING"})
    void retainsWorkWhileAssetIsInProgress(String status) {
        when(assets.findById(work.assetId())).thenReturn(asset(work, status));

        assertThat(worker.process(work)).isFalse();

        verifyNoInteractions(recovery, media);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DELETED", "QUARANTINED"})
    void removesTerminalWorkWithoutRepairingIt(String status) {
        when(assets.findById(work.assetId())).thenReturn(asset(work, status));

        worker.process(work);

        verify(recovery).remove(work);
        verifyNoInteractions(media);
    }

    @Test
    void repairsReadyAssetBeforeRemovingWork() {
        var ready = asset(work, "READY");
        when(assets.findById(work.assetId())).thenReturn(ready);

        worker.process(work);

        var ordered = inOrder(assets, media, recovery);
        ordered.verify(assets).findById(work.assetId());
        ordered.verify(media).repairReadyUpload(work, ready);
        ordered.verify(recovery).remove(work);
    }

    @Test
    void retainsFailedRepairAndContinuesWithTheNextItem() {
        var next = work();
        var failed = asset(work, "READY");
        var ready = asset(next, "READY");
        when(recovery.list(eq(0), isNull(), anyInt())).thenReturn(List.of(work, next));
        when(assets.findById(work.assetId())).thenReturn(failed);
        when(assets.findById(next.assetId())).thenReturn(ready);
        doThrow(new IllegalStateException("thumbnail projection unavailable"))
                .when(media).repairReadyUpload(work, failed);

        worker.tick();

        verify(recovery, never()).remove(work);
        var ordered = inOrder(media, recovery);
        ordered.verify(media).repairReadyUpload(work, failed);
        ordered.verify(media).repairReadyUpload(next, ready);
        ordered.verify(recovery).remove(next);
    }

    @Test
    void ownerMismatchDoesNotRepairOrRemoveWork() {
        var mismatchedOwner = new Work(work.assetId(), UUID.randomUUID(), work.uploadId());
        when(recovery.list(eq(0), isNull(), anyInt())).thenReturn(List.of(work));
        when(assets.findById(work.assetId())).thenReturn(asset(mismatchedOwner, "READY"));

        worker.tick();

        verify(recovery, never()).remove(work);
        verifyNoInteractions(media);
    }

    @Test
    void uploadIdentityMismatchDoesNotRepairOrRemoveWork() {
        var wrongUpload = new Work(work.assetId(), work.ownerId(), UUID.randomUUID());
        when(recovery.list(eq(0), isNull(), anyInt())).thenReturn(List.of(wrongUpload));
        lenient().when(assets.findById(work.assetId())).thenReturn(asset(work, "READY"));

        worker.tick();

        verify(recovery, never()).remove(wrongUpload);
        verifyNoInteractions(media);
    }

    @Test
    void skipsMissingAndYoungPendingAuthorityWhenProbingIsEnabled() {
        worker = new MediaUploadRecoveryWorker(recovery, assets, media, true);
        var young = work();
        when(assets.findById(work.assetId())).thenReturn(null);
        when(assets.findById(young.assetId())).thenReturn(asset(young, "PENDING", Instant.now()));

        assertThat(worker.process(work)).isFalse();
        assertThat(worker.process(young)).isFalse();

        verifyNoInteractions(media, recovery);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void agedPendingWorkIsRemovedOnlyAfterVerifiedRecovery(boolean recovered) {
        worker = new MediaUploadRecoveryWorker(recovery, assets, media, true);
        var pending = asset(work, "PENDING");
        when(assets.findById(work.assetId())).thenReturn(pending);
        when(media.recoverPendingUpload(work, pending)).thenReturn(recovered);

        assertThat(worker.process(work)).isTrue();

        var ordered = inOrder(media, recovery);
        ordered.verify(media).recoverPendingUpload(work, pending);
        if (recovered) ordered.verify(recovery).remove(work);
        else verify(recovery, never()).remove(work);
    }

    @Test
    void failedProbeUsesTheTickBudgetAndRetainsTheUnvisitedCursorRange() {
        worker = new MediaUploadRecoveryWorker(recovery, assets, media, true);
        var next = work();
        var failed = asset(work, "PENDING");
        var pending = asset(next, "PENDING");
        when(recovery.list(eq(0), isNull(), anyInt())).thenReturn(List.of(work, next));
        when(recovery.list(eq(0), eq(work.assetId()), anyInt())).thenReturn(List.of(next));
        when(assets.findById(work.assetId())).thenReturn(failed);
        when(assets.findById(next.assetId())).thenReturn(pending);
        when(media.recoverPendingUpload(work, failed)).thenThrow(new IllegalStateException("provider unavailable"));
        when(media.recoverPendingUpload(next, pending)).thenReturn(true);

        worker.tick();

        verify(media).recoverPendingUpload(work, failed);
        verify(assets, never()).findById(next.assetId());
        verify(recovery, never()).remove(work);

        for (int tick = 0; tick < MediaUploadRecoveryRepository.SHARDS; tick++) worker.tick();

        var ordered = inOrder(recovery, media);
        ordered.verify(recovery).list(eq(0), eq(work.assetId()), anyInt());
        ordered.verify(media).recoverPendingUpload(next, pending);
        ordered.verify(recovery).remove(next);
    }

    private static Work work() {
        var owner = UUID.randomUUID();
        var upload = UUID.randomUUID();
        return new Work(MediaUploadIdentity.of(owner, upload).assetId(), owner, upload);
    }

    private static MediaAsset asset(Work work, String status) {
        return asset(work, status, Instant.EPOCH);
    }

    private static MediaAsset asset(Work work, String status, Instant createdAt) {
        return new MediaAsset(work.assetId(), work.ownerId(), "CLOUDINARY",
                "chatapp/" + work.ownerId() + "/" + work.assetId(), null,
                "fixture.png", "image/png", 12, null, null, null, "fixture-checksum",
                status, "PENDING", "PENDING", createdAt, null);
    }
}
