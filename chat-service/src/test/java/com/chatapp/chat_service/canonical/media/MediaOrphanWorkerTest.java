package com.chatapp.chat_service.canonical.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaOrphanWorkerTest {
    @Mock MediaOrphanRepository candidates;
    @Mock MediaAssetRepository assets;
    @Mock MediaDeletionRecoveryRepository deletions;

    private final MediaOrphanRepository.Work work =
            new MediaOrphanRepository.Work(UUID.randomUUID(), UUID.randomUUID());
    private final MediaDeletionRecoveryRepository.Work deletion =
            new MediaDeletionRecoveryRepository.Work(work.assetId(), work.ownerId());
    private final Instant cutoff = Instant.parse("2026-10-27T00:00:00Z");

    private MediaOrphanWorker worker() {
        return new MediaOrphanWorker(candidates, assets, deletions, 7);
    }

    @Test
    void waitingCandidateStaysDiscoverableWithoutAnyWrite() {
        when(assets.orphanState(work, cutoff)).thenReturn(MediaAssetRepository.OrphanState.WAITING);

        worker().process(work, cutoff);

        verify(assets).orphanState(work, cutoff);
        verifyNoMoreInteractions(assets);
        verifyNoInteractions(candidates, deletions);
    }

    @Test
    void ineligibleAuthorityOnlyRemovesTheOrphanCandidate() {
        when(assets.orphanState(work, cutoff)).thenReturn(MediaAssetRepository.OrphanState.DISCARD);

        worker().process(work, cutoff);

        verify(candidates).remove(work);
        verify(assets, never()).claimOrphan(work, cutoff);
        verifyNoInteractions(deletions);
    }

    @Test
    void durableDeletionPointerPrecedesClaimAndSuccessfulClaimCleansCandidate() {
        when(assets.orphanState(work, cutoff)).thenReturn(MediaAssetRepository.OrphanState.ELIGIBLE);
        when(assets.claimOrphan(work, cutoff)).thenReturn(true);

        worker().process(work, cutoff);

        var order = inOrder(assets, deletions, candidates);
        order.verify(assets).orphanState(work, cutoff);
        order.verify(deletions).register(deletion);
        order.verify(assets).claimOrphan(work, cutoff);
        order.verify(candidates).remove(work);
    }

    @Test
    void competingRetentionKeepsCandidateWhenClaimDoesNotApply() {
        when(assets.orphanState(work, cutoff)).thenReturn(MediaAssetRepository.OrphanState.ELIGIBLE);
        when(assets.claimOrphan(work, cutoff)).thenReturn(false);

        worker().process(work, cutoff);

        verify(deletions).register(deletion);
        verify(candidates, never()).remove(work);
    }

    @Test
    void failedPointerRegistrationCannotStartDeletion() {
        when(assets.orphanState(work, cutoff)).thenReturn(MediaAssetRepository.OrphanState.ELIGIBLE);
        doThrow(new IllegalStateException("index unavailable")).when(deletions).register(deletion);

        assertThatThrownBy(() -> worker().process(work, cutoff)).isInstanceOf(IllegalStateException.class);

        verify(assets, never()).claimOrphan(work, cutoff);
        verifyNoInteractions(candidates);
    }

    @Test
    void lostClaimAcknowledgementKeepsCandidateAndDeletionPointer() {
        when(assets.orphanState(work, cutoff)).thenReturn(MediaAssetRepository.OrphanState.ELIGIBLE);
        when(assets.claimOrphan(work, cutoff)).thenThrow(new IllegalStateException("claim outcome unknown"));

        assertThatThrownBy(() -> worker().process(work, cutoff)).isInstanceOf(IllegalStateException.class);

        verify(deletions).register(deletion);
        verify(deletions, never()).remove(deletion);
        verifyNoInteractions(candidates);
    }
}
