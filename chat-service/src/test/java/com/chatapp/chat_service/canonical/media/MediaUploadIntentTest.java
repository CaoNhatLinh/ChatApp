package com.chatapp.chat_service.canonical.media;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import com.cloudinary.Cloudinary;
import com.cloudinary.api.ApiResponse;
import java.util.UUID;
import java.util.Map;
import java.io.IOException;
import java.util.List;
import com.chatapp.chat_service.common.exception.ConflictException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MediaUploadIntentTest {
    final Cloudinary provider = mock(Cloudinary.class, withSettings().useConstructor(Map.of("cloud_name", "test")).defaultAnswer(RETURNS_DEEP_STUBS));
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final MediaUploadRecoveryRepository recovery = mock(MediaUploadRecoveryRepository.class);
    final MediaDeletionRecoveryRepository deletions = mock(MediaDeletionRecoveryRepository.class);
    final MediaOrphanRepository orphans = mock(MediaOrphanRepository.class);
    final CloudinaryMediaService service = new CloudinaryMediaService(provider, assets, recovery, deletions, orphans);
    final MediaUploadTestStore store = new MediaUploadTestStore(assets);
    final Map<UUID, MediaAsset> states = store.states;
    final Map<UUID, MediaUploadReceipt> receipts = store.receipts;

    @Test void providerCannotRunUntilPendingIntentIsDurablyClaimed() {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        doThrow(new IllegalStateException("store unavailable")).when(assets).claimUpload(any());
        var file = new MockMultipartFile("file", "hello.txt", "text/plain", new byte[]{1});
        assertThatThrownBy(() -> service.upload(owner, upload, file)).isInstanceOf(IllegalStateException.class);
        var order = inOrder(recovery, assets);
        order.verify(recovery).register(new MediaUploadRecoveryRepository.Work(
                MediaUploadIdentity.of(owner, upload).assetId(), owner, upload));
        order.verify(assets).claimUpload(argThat(asset -> asset.ownerId().equals(owner)
                && asset.uploadStatus().equals("PENDING") && asset.publicUrl() == null
                && asset.checksumSha256().length() == 64));
        verifyNoInteractions(provider);
    }

    @Test void failedDiscoveryWriteStopsBeforeTheAuthorityClaimOrProvider() {
        doThrow(new IllegalStateException("index unavailable")).when(recovery).register(any());
        assertThatThrownBy(() -> service.upload(UUID.randomUUID(), UUID.randomUUID(),
                text("file.txt", "text/plain", new byte[]{1}))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(assets, provider);
    }

    @Test void failedDiscoveryCleanupCannotHideAConfirmedReceipt() throws Exception {
        respond();
        doThrow(new IllegalStateException("index unavailable")).when(recovery).remove(any());
        var result = service.upload(UUID.randomUUID(), UUID.randomUUID(), text("file.txt", "text/plain", new byte[]{1}));
        assertThat(result.assetId()).isIn(receipts.keySet());
        verify(recovery).remove(any());
    }

    @Test void retryKeepsTheSameAssetAndAttachmentWithoutCallingProviderAgain() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        var file = new MockMultipartFile("file", "hello.txt", "text/plain", new byte[]{1});
        when(provider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            assertThat(states).hasSize(1);
            Map<?, ?> options = call.getArgument(1);
            return providerResult(options);
        });
        var first = service.upload(owner, upload, file);
        var replay = service.upload(owner, upload, file);
        assertThat(replay).isEqualTo(first);
        verifyNoInteractions(orphans);
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void composerUploadRegistersOrphanCandidateBeforeClaimAndRejectsPurposeChange() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        var file = text("file.txt", "text/plain", new byte[]{1});
        respond();

        var uploaded = service.upload(owner, upload, file, UploadPurpose.COMPOSER);
        var candidate = new MediaOrphanRepository.Work(uploaded.assetId(), owner);
        var order = inOrder(orphans, assets);
        order.verify(orphans).register(candidate);
        order.verify(assets).claimUpload(argThat(asset -> "COMPOSER".equals(asset.uploadPurpose())));
        assertThat(states.get(uploaded.assetId()).uploadPurpose()).isEqualTo("COMPOSER");

        assertThatThrownBy(() -> service.upload(owner, upload, file, UploadPurpose.GENERAL))
                .isInstanceOf(ConflictException.class);
        verify(orphans).register(candidate);
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void composerRetryCannotReclassifyAnExistingGeneralUpload() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        var file = text("file.txt", "text/plain", new byte[]{1});
        respond();

        var uploaded = service.upload(owner, upload, file, UploadPurpose.GENERAL);
        assertThat(service.upload(owner, upload, file, UploadPurpose.COMPOSER)).isEqualTo(uploaded);
        assertThat(states.get(uploaded.assetId()).uploadPurpose()).isNull();
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void changedBytesNameOrMimeCannotReuseAnIntentEvenAfterReady() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        respond(); service.upload(owner, upload, text("hello.txt", "text/plain", new byte[]{1}));
        for (var changed : List.of(text("hello.txt", "text/plain", new byte[]{2}),
                text("renamed.txt", "text/plain", new byte[]{1}), text("hello.txt", "application/pdf", new byte[]{1}))) {
            assertThatThrownBy(() -> service.upload(owner, upload, changed)).isInstanceOf(ConflictException.class);
        }
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void providerFailureLeavesPendingAndRetryUsesTheSameKeyWithoutOverwrite() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        var keys = new java.util.ArrayList<String>();
        when(provider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            Map<?, ?> options = call.getArgument(1); keys.add((String) options.get("public_id"));
            assertThat(options.get("overwrite")).isEqualTo(false);
            assertThat(options.containsKey("folder")).isFalse();
            if (keys.size() == 1) throw new IOException("lost provider acknowledgement");
            return providerResult(options);
        });
        assertThatThrownBy(() -> service.upload(owner, upload, text("file.txt", "text/plain", new byte[]{1})))
                .isInstanceOf(IllegalStateException.class);
        assertThat(states.values()).allMatch(asset -> asset.uploadStatus().equals("PENDING"));
        service.upload(owner, upload, text("file.txt", "text/plain", new byte[]{1}));
        assertThat(keys).hasSize(2); assertThat(keys.get(0)).isEqualTo(keys.get(1)).endsWith(".txt");
    }

    @Test void authenticatedProviderMetadataRecoversLostUploadWithoutUploadingAgain() throws Exception {
        var signedProvider = mock(Cloudinary.class, withSettings()
                .useConstructor(Map.of("cloud_name", "test", "api_secret", "test-only-secret"))
                .defaultAnswer(RETURNS_DEEP_STUBS));
        var signedService = new CloudinaryMediaService(signedProvider, assets, recovery, deletions, orphans);
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        var identity = MediaUploadIdentity.of(owner, upload);
        var work = new MediaUploadRecoveryRepository.Work(identity.assetId(), owner, upload);
        var context = new java.util.concurrent.atomic.AtomicReference<String>();
        when(signedProvider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            Map<?, ?> options = call.getArgument(1);
            context.set((String) options.get("context"));
            throw new IOException("lost upload acknowledgement");
        });
        assertThatThrownBy(() -> signedService.upload(owner, upload, text("file.txt", "text/plain", new byte[]{1})))
                .isInstanceOf(IllegalStateException.class);
        assertThat(context.get()).matches("noi_upload_proof=[0-9a-f]{64}");
        var pending = states.get(work.assetId());
        var response = mock(ApiResponse.class);
        var proof = context.get().substring("noi_upload_proof=".length());
        when(response.get("resources")).thenReturn(List.of(Map.of(
                "public_id", pending.storageKey(), "type", "upload", "resource_type", "raw", "bytes", 1,
                "secure_url", "https://res.cloudinary.com/test/raw/upload/" + pending.storageKey(),
                "context", Map.of("custom", Map.of("noi_upload_proof", proof)))));
        when(signedProvider.api().resourcesByIds(eq(List.of(pending.storageKey())), anyMap())).thenReturn(response);

        assertThat(signedService.recoverPendingUpload(work, pending)).isTrue();
        assertThat(signedService.inspectUpload(owner, upload).file().attachmentId()).isEqualTo(identity.attachmentId());
        verify(signedProvider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void lostLocalAcknowledgementReturnsStoredReceiptAfterProcessRestart() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID(); respond();
        doAnswer(call -> {
            MediaUploadReceipt receipt = call.getArgument(0);
            receipts.put(receipt.asset().assetId(), receipt); states.put(receipt.asset().assetId(), receipt.asset());
            throw new IllegalStateException("commit acknowledgement lost");
        }).when(assets).completeUpload(any());
        var file = text("file.txt", "text/plain", new byte[]{1});
        assertThatThrownBy(() -> service.upload(owner, upload, file)).isInstanceOf(IllegalStateException.class);
        var restarted = new CloudinaryMediaService(provider, assets, recovery, deletions, orphans);
        assertThat(restarted.upload(owner, upload, file).assetId()).isEqualTo(MediaUploadIdentity.of(owner, upload).assetId());
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void interruptedThumbnailProjectionRepairsOnlyFromWinningReceipt() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        when(provider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            Map<?, ?> options = call.getArgument(1);
            return Map.of("public_id", options.get("public_id"), "secure_url", "https://res.cloudinary.com/test/image/upload/" + options.get("public_id") + ".png",
                    "resource_type", "image", "width", 2, "height", 3);
        });
        doThrow(new IllegalStateException("projection unavailable")).doNothing().when(assets).repairUploadThumbnails(any());
        var buffer = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2, 3, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", buffer);
        var file = text("file.png", "image/png", buffer.toByteArray());
        assertThatThrownBy(() -> service.upload(owner, upload, file)).isInstanceOf(IllegalStateException.class);
        var work = new MediaUploadRecoveryRepository.Work(MediaUploadIdentity.of(owner, upload).assetId(), owner, upload);
        verify(recovery, never()).remove(work);
        new MediaUploadRecoveryWorker(recovery, assets, service, false).process(work);
        verify(recovery).remove(work);
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
        verify(assets, times(2)).repairUploadThumbnails(same(receipts.values().iterator().next()));
        assertThat(receipts.values().iterator().next().thumbnails()).hasSize(3)
                .allMatch(thumbnail -> thumbnail.status() == MediaThumbnail.Status.UNAVAILABLE);
    }

    @Test void concurrentCompletionWinsInsteadOfTheLosingWorkersCandidate() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        when(provider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            MediaAsset pending = states.values().iterator().next();
            MediaAsset winner = ready(pending);
            receipts.put(winner.assetId(), new MediaUploadReceipt(winner, MediaUploadIdentity.of(owner, upload).attachmentId(), List.of()));
            states.put(winner.assetId(), winner);
            return providerResult(call.getArgument(1));
        });
        var result = service.upload(owner, upload, text("file.txt", "text/plain", new byte[]{1}));
        assertThat(result.url()).isEqualTo("https://res.cloudinary.com/test/raw/upload/v2/" + result.storageKey());
        assertThat(result.attachmentId()).isEqualTo(MediaUploadIdentity.of(owner, upload).attachmentId());
    }

    @Test void deletionAfterOtherWorkersCompletionCannotBeResurrectedByLateUploader() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID();
        when(provider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            MediaAsset winner = ready(states.values().iterator().next());
            receipts.put(winner.assetId(), new MediaUploadReceipt(winner, MediaUploadIdentity.of(owner, upload).attachmentId(), List.of()));
            states.put(winner.assetId(), status(winner, "DELETING"));
            return providerResult(call.getArgument(1));
        });
        assertThatThrownBy(() -> service.upload(owner, upload, text("file.txt", "text/plain", new byte[]{1})))
                .isInstanceOf(ConflictException.class);
        assertThat(states.values()).allMatch(asset -> asset.uploadStatus().equals("DELETING"));
        verify(assets, never()).repairUploadThumbnails(any());
    }

    @Test void readyReplayCannotReturnDeletingDeletedOrQuarantinedMedia() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID(); respond();
        var file = text("file.txt", "text/plain", new byte[]{1}); var result = service.upload(owner, upload, file);
        MediaAsset ready = states.get(result.assetId());
        for (String state : List.of("DELETING", "DELETED", "QUARANTINED")) {
            states.put(result.assetId(), status(ready, state));
            assertThatThrownBy(() -> service.upload(owner, upload, file)).isInstanceOf(ConflictException.class);
        }
        verify(provider.uploader(), times(1)).upload(any(byte[].class), anyMap());
    }

    @Test void ownerInspectionDoesNotUploadOrRepairAndOtherOwnersCannotSeeTheIntent() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID(); respond();
        var first = service.upload(owner, upload, text("file.txt", "text/plain", new byte[]{1}));
        clearInvocations(provider, assets);
        assertThat(service.inspectUpload(owner, upload).file()).isEqualTo(first);
        assertThatThrownBy(() -> service.inspectUpload(UUID.randomUUID(), upload))
                .isInstanceOf(com.chatapp.chat_service.common.exception.NotFoundException.class);
        verifyNoInteractions(provider); verify(assets, never()).repairUploadThumbnails(any());
    }

    @Test void persistedReceiptWithWrongProviderUrlCannotReplayOrInspectAsReady() throws Exception {
        UUID owner = UUID.randomUUID(), upload = UUID.randomUUID(); respond();
        var file = text("file.txt", "text/plain", new byte[]{1});
        var uploaded = service.upload(owner, upload, file);
        MediaAsset ready = states.get(uploaded.assetId());
        MediaAsset invalid = new MediaAsset(ready.assetId(), ready.ownerId(), ready.storageProvider(), ready.storageKey(),
                "https://res.cloudinary.com/other/raw/upload/" + ready.storageKey(), ready.fileName(), ready.mimeType(),
                ready.byteSize(), ready.width(), ready.height(), ready.durationMs(), ready.checksumSha256(),
                ready.uploadStatus(), ready.malwareScanStatus(), ready.moderationStatus(), ready.createdAt(), ready.deletedAt());
        states.put(invalid.assetId(), invalid);
        receipts.put(invalid.assetId(), new MediaUploadReceipt(invalid, uploaded.attachmentId(), List.of()));
        clearInvocations(provider, assets);
        assertThatThrownBy(() -> service.upload(owner, upload, file)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> service.inspectUpload(owner, upload)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(provider);
        verify(assets, never()).repairUploadThumbnails(any());
    }

    private void respond() throws IOException {
        when(provider.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> providerResult(call.getArgument(1)));
    }
    private static Map<String, Object> providerResult(Map<?, ?> options) {
        return Map.of("public_id", options.get("public_id"), "secure_url", "https://res.cloudinary.com/test/raw/upload/v1/" + options.get("public_id"), "resource_type", "raw");
    }
    private static MockMultipartFile text(String name, String mime, byte[] bytes) { return new MockMultipartFile("file", name, mime, bytes); }
    private static MediaAsset ready(MediaAsset pending) {
        return new MediaAsset(pending.assetId(), pending.ownerId(), pending.storageProvider(), pending.storageKey(),
                "https://res.cloudinary.com/test/raw/upload/v2/" + pending.storageKey(), pending.fileName(), pending.mimeType(), pending.byteSize(),
                null, null, null, pending.checksumSha256(), "READY", "PENDING", "PENDING", pending.createdAt(), null);
    }
    private static MediaAsset status(MediaAsset asset, String status) {
        return new MediaAsset(asset.assetId(), asset.ownerId(), asset.storageProvider(), asset.storageKey(), asset.publicUrl(),
                asset.fileName(), asset.mimeType(), asset.byteSize(), asset.width(), asset.height(), asset.durationMs(), asset.checksumSha256(),
                status, asset.malwareScanStatus(), asset.moderationStatus(), asset.createdAt(), asset.deletedAt());
    }
}
