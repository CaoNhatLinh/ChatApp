package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest;
import com.chatapp.chat_service.canonical.media.MediaAsset;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.media.MediaThumbnail;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageAttachmentPolicyTest {
    private final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    private final MessageAttachmentPolicy policy = new MessageAttachmentPolicy(assets);
    private final UUID owner = UUID.randomUUID();
    private final UUID assetId = UUID.randomUUID();
    private final AttachmentRequest attachment = new AttachmentRequest(UUID.randomUUID(), assetId,
            "CLOUDINARY", "key", "file.png", "image/png", 10L, null, null, null, null, false);

    private MediaAsset asset(UUID actor, Instant deletedAt) {
        return new MediaAsset(assetId, actor, "CLOUDINARY", "key", "https://res.cloudinary.com/file.png",
                "file.png", "image/png", 10L, null, null, null, "checksum", "READY", "PENDING", "PENDING", Instant.now(), deletedAt);
    }

    @Test void acceptsOnlyCanonicalUploadMetadata() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        assertThatCode(() -> policy.validate(owner, List.of(attachment))).doesNotThrowAnyException();
        var forged = new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "another-key",
                "file.png", "image/png", 10L, null, null, null, null, false);
        assertThatThrownBy(() -> policy.validate(owner, List.of(forged))).isInstanceOf(BadRequestException.class);
    }

    @Test void rejectsAnotherUsersUploadAndDeletedAssets() {
        when(assets.findById(assetId)).thenReturn(asset(UUID.randomUUID(), null), asset(owner, Instant.now()));
        assertThatThrownBy(() -> policy.validate(owner, List.of(attachment))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> policy.validate(owner, List.of(attachment))).isInstanceOf(ForbiddenException.class);
    }

    @Test void rejectsDuplicateAttachmentIds() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        assertThatThrownBy(() -> policy.validate(owner, List.of(attachment, attachment))).isInstanceOf(BadRequestException.class);
    }

    @Test void rejectsThumbnailUrlNotConfirmedForThisAsset() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        var forged = new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "key",
                "file.png", "image/png", 10L, null, null, null, "https://other.example/fake.png", false);
        assertThatThrownBy(() -> policy.validate(owner, List.of(forged))).isInstanceOf(BadRequestException.class);
    }

    @Test void acceptsExactReadyThumbnailAndSourceVerifiedForwardOnly() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        String url = "https://res.cloudinary.com/small/file.png";
        when(assets.findThumbnails(assetId)).thenReturn(List.of(new MediaThumbnail(MediaThumbnail.Variant.SMALL,
                MediaThumbnail.Status.READY, url, 120, 80, Instant.now())));
        assertThatCode(() -> policy.validate(owner, List.of(withThumbnail(url)))).doesNotThrowAnyException();
        when(assets.findById(assetId)).thenReturn(asset(UUID.randomUUID(), null));
        assertThatCode(() -> policy.validateForwarded(List.of(withThumbnail(url)))).doesNotThrowAnyException();
    }

    @Test void unavailableFailedAndWrongReadyVariantCannotAuthorizeAThumbnail() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        for (var status : List.of(MediaThumbnail.Status.FAILED, MediaThumbnail.Status.UNAVAILABLE)) {
            when(assets.findThumbnails(assetId)).thenReturn(List.of(new MediaThumbnail(MediaThumbnail.Variant.SMALL,
                    status, null, null, null, Instant.now())));
            assertThatThrownBy(() -> policy.validate(owner, List.of(withThumbnail("https://res.cloudinary.com/small/file.png"))))
                    .isInstanceOf(BadRequestException.class);
        }
        when(assets.findThumbnails(assetId)).thenReturn(List.of(new MediaThumbnail(MediaThumbnail.Variant.SMALL,
                MediaThumbnail.Status.READY, "https://res.cloudinary.com/other.png", 120, 80, Instant.now())));
        assertThatThrownBy(() -> policy.validate(owner, List.of(withThumbnail("https://res.cloudinary.com/small/file.png"))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> policy.validateForwarded(List.of(withThumbnail("https://res.cloudinary.com/small/file.png"))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void optionalNullThumbnailNeedsNoVariantReadButBlankUrlIsNotAnOptionalValue() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        policy.validate(owner, List.of(attachment));
        verify(assets, never()).findThumbnails(assetId);
        assertThatThrownBy(() -> policy.validate(owner, List.of(withThumbnail("")))).isInstanceOf(BadRequestException.class);
    }

    @Test void authorizationPrecedesThumbnailReadAndStoreFailuresRemainFailures() {
        when(assets.findById(assetId)).thenReturn(asset(UUID.randomUUID(), null));
        var request = withThumbnail("https://res.cloudinary.com/small/file.png");
        assertThatThrownBy(() -> policy.validate(owner, List.of(request))).isInstanceOf(ForbiddenException.class);
        verify(assets, never()).findThumbnails(assetId);
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        when(assets.findThumbnails(assetId)).thenThrow(new IllegalStateException("database unavailable"));
        assertThatThrownBy(() -> policy.validate(owner, List.of(request))).isInstanceOf(IllegalStateException.class);
    }

    @Test void exactDimensionsAndDurationAreRequiredNotGuessedFromMissingFields() {
        when(assets.findById(assetId)).thenReturn(new MediaAsset(assetId, owner, "CLOUDINARY", "key",
                "https://res.cloudinary.com/file.mp4", "clip.mp4", "video/mp4", 10L, 1280, 720, 2301L,
                "checksum", "READY", "PENDING", "PENDING", Instant.now(), null));
        var exact = new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "key",
                "clip.mp4", "video/mp4", 10L, 1280, 720, 2301L, null, false);
        assertThatCode(() -> policy.validate(owner, List.of(exact))).doesNotThrowAnyException();
        var dropped = new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "key",
                "clip.mp4", "video/mp4", 10L, null, null, null, null, false);
        assertThatThrownBy(() -> policy.validate(owner, List.of(dropped))).isInstanceOf(BadRequestException.class);
    }

    private AttachmentRequest withThumbnail(String url) {
        return new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "key",
                "file.png", "image/png", 10L, null, null, null, url, false);
    }

    @Test void sourceVerifiedForwardCanReuseAnotherOwnersReadyAssetButNotDeletedOrForgedMetadata() {
        when(assets.findById(assetId)).thenReturn(asset(UUID.randomUUID(), null));
        assertThatCode(() -> policy.validateForwarded(List.of(attachment))).doesNotThrowAnyException();
        var forged = new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "forged-key",
                "file.png", "image/png", 10L, null, null, null, null, false);
        assertThatThrownBy(() -> policy.validateForwarded(List.of(forged))).isInstanceOf(BadRequestException.class);
        when(assets.findById(assetId)).thenReturn(asset(owner, Instant.now()));
        assertThatThrownBy(() -> policy.validateForwarded(List.of(attachment))).isInstanceOf(ForbiddenException.class);
    }

    @Test void retainsEachDistinctAssetOnce() {
        UUID secondAssetId = UUID.randomUUID();
        var sameAsset = new AttachmentRequest(UUID.randomUUID(), assetId, "CLOUDINARY", "key",
                "file.png", "image/png", 10L, null, null, null, null, false);
        var secondAsset = new AttachmentRequest(UUID.randomUUID(), secondAssetId, "CLOUDINARY", "other-key",
                "other.png", "image/png", 10L, null, null, null, null, false);
        when(assets.retainForHistory(assetId)).thenReturn(true);
        when(assets.retainForHistory(secondAssetId)).thenReturn(true);

        policy.retainForHistory(List.of(attachment, sameAsset, secondAsset));

        verify(assets).retainForHistory(assetId);
        verify(assets).retainForHistory(secondAssetId);
        verifyNoMoreInteractions(assets);
    }

    @Test void refusesToRetainAnAssetWhenItsAuthorityHasChanged() {
        when(assets.retainForHistory(assetId)).thenReturn(false);

        assertThatThrownBy(() -> policy.retainForHistory(List.of(attachment)))
                .isInstanceOf(ConflictException.class);
        verify(assets).retainForHistory(assetId);
        verifyNoMoreInteractions(assets);
    }

    @Test void absentAttachmentsNeedNoRetentionWrite() {
        policy.retainForHistory(null);
        policy.retainForHistory(List.of());

        verifyNoInteractions(assets);
    }
}
