package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.ConflictException;
import com.cloudinary.Cloudinary;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CloudinaryMediaDeletionTest {
    final Cloudinary cloudinary = mock(Cloudinary.class, RETURNS_DEEP_STUBS);
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final MediaDeletionRecoveryRepository recovery = mock(MediaDeletionRecoveryRepository.class);
    final CloudinaryMediaService service = new CloudinaryMediaService(cloudinary, assets,
            mock(MediaUploadRecoveryRepository.class), recovery, mock(MediaOrphanRepository.class));
    final UUID actor = UUID.randomUUID(), id = UUID.randomUUID();
    MediaAsset asset(String status) {
        return new MediaAsset(id, actor, "CLOUDINARY", "x", "https://example.com/x", "x.webp", "image/webp",
                100, 32, 32, null, null, status, "PENDING", "PENDING", Instant.now(), null);
    }
    @Test void retainedAssetCannotReachProviderDeletion() throws Exception {
        when(assets.findById(id)).thenReturn(asset("READY"));
        when(assets.claimDeletion(id)).thenReturn(false);
        assertThatThrownBy(() -> service.delete(actor, id)).isInstanceOf(ConflictException.class);
        verifyNoInteractions(cloudinary);
        verify(assets, never()).markDeleted(any(), any());
    }
    @Test void providerMustConfirmDeletionBeforeLocalTombstone() throws Exception {
        when(assets.findById(id)).thenReturn(asset("READY"), asset("DELETING"));
        when(assets.claimDeletion(id)).thenReturn(true);
        when(cloudinary.uploader().destroy(eq("x"), anyMap())).thenReturn(Map.of("result", "failed"));
        assertThatThrownBy(() -> service.delete(actor, id)).isInstanceOf(IllegalStateException.class);
        verify(assets, never()).markDeleted(any(), any());
        verify(recovery, never()).remove(any());
    }
    @Test void interruptedDeletionCanRetryAndAlreadyAbsentProviderObjectIsSuccess() throws Exception {
        when(assets.findById(id)).thenReturn(asset("DELETING"));
        when(cloudinary.uploader().destroy(eq("x"), anyMap())).thenReturn(Map.of("result", "not found"));
        when(assets.markDeleted(eq(id), any())).thenReturn(true);
        service.delete(actor, id);
        verify(assets, never()).claimDeletion(any());
        verify(assets).markDeleted(eq(id), any());
    }

    @Test void failedRegistrationCannotClaimOrDeleteTheAsset() {
        when(assets.findById(id)).thenReturn(asset("READY"));
        doThrow(new IllegalStateException("index unavailable")).when(recovery).register(any());
        assertThatThrownBy(() -> service.delete(actor, id)).isInstanceOf(IllegalStateException.class);
        verify(assets, never()).claimDeletion(any());
        verifyNoInteractions(cloudinary);
    }

    @Test void backgroundRetryCompletesAnAuthorizedDeletionAfterLostProviderResponse() throws Exception {
        var work = new MediaDeletionRecoveryRepository.Work(id, actor);
        when(assets.findById(id)).thenReturn(asset("READY"), asset("DELETING"), asset("DELETING"));
        when(assets.claimDeletion(id)).thenReturn(true);
        when(cloudinary.uploader().destroy(eq("x"), anyMap()))
                .thenThrow(new java.io.IOException("lost response")).thenReturn(Map.of("result", "not found"));
        when(assets.markDeleted(eq(id), any())).thenReturn(true);
        assertThatThrownBy(() -> service.delete(actor, id)).isInstanceOf(IllegalStateException.class);
        verify(recovery, never()).remove(work);
        assertThat(new MediaDeletionRecoveryWorker(recovery, assets, service).process(work)).isTrue();
        var order = inOrder(recovery, assets);
        order.verify(recovery).register(work);
        order.verify(assets).claimDeletion(id);
        order.verify(assets).markDeleted(eq(id), any());
        order.verify(recovery).remove(work);
    }
}
