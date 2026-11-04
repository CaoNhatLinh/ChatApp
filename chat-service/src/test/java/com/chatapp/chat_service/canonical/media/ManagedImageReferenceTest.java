package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ManagedImageReferenceTest {
    private final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    private final ManagedImageReference references = new ManagedImageReference(assets, "noi-fixture");
    private final UUID ownerId = UUID.randomUUID();
    private final UUID assetId = UUID.randomUUID();
    private final String key = "chatapp/" + ownerId + "/" + assetId;
    private final String url = "https://res.cloudinary.com/noi-fixture/image/upload/v123/" + key + ".png";

    @Test
    void retainsMatchingManagedImageBeforeItCanBeReferenced() {
        when(assets.findById(assetId)).thenReturn(asset(ownerId, key, "image/png", "READY"));
        when(assets.retainForHistory(assetId)).thenReturn(true);

        references.retain(url);

        var order = inOrder(assets);
        order.verify(assets).findById(assetId);
        order.verify(assets).retainForHistory(assetId);
    }

    @Test
    void retainsTransformedAndEncodedAliasForSameManagedAsset() {
        when(assets.findById(assetId)).thenReturn(asset(ownerId, key, "image/png", "READY"));
        when(assets.retainForHistory(assetId)).thenReturn(true);
        var alias = "http://res.cloudinary.com/noi-fixture/image/upload/c_fill,w_40/v123/%63hatapp/"
                + ownerId + "/" + assetId + ".webp";

        references.retain(alias);

        verify(assets).retainForHistory(assetId);
    }

    @Test
    void externalUrlsAndOtherTenantsNeverReadOrLockAssets() {
        references.retain(null);
        references.retain(" ");
        references.retain(url.replace("res.cloudinary.com", "res.cloudinary.com.example.test"));
        references.retain(url.replace("noi-fixture", "unrelated-cloud"));
        references.retain("https://res.cloudinary.com/noi-fixture/image/upload/v123/vendor/logo.png");

        verifyNoInteractions(assets);
    }

    @Test
    void missingManagedImageFailsClosed() {
        assertThatThrownBy(() -> references.retain(url)).isInstanceOf(ForbiddenException.class);

        verify(assets).findById(assetId);
        verifyNoMoreInteractions(assets);
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "key", "mime", "state"})
    void mismatchedManagedImageCannotBeRetained(String mismatch) {
        var record = asset("owner".equals(mismatch) ? UUID.randomUUID() : ownerId,
                "key".equals(mismatch) ? key + "-wrong" : key,
                "mime".equals(mismatch) ? "video/mp4" : "image/png",
                "state".equals(mismatch) ? "DELETING" : "READY");
        when(assets.findById(assetId)).thenReturn(record);

        assertThatThrownBy(() -> references.retain(url)).isInstanceOf(ForbiddenException.class);

        verify(assets).findById(assetId);
        verifyNoMoreInteractions(assets);
    }

    @Test
    void competingDeletionBlocksTheReference() {
        when(assets.findById(assetId)).thenReturn(asset(ownerId, key, "image/png", "READY"));
        when(assets.retainForHistory(assetId)).thenReturn(false);

        assertThatThrownBy(() -> references.retain(url)).isInstanceOf(ConflictException.class);

        verify(assets).retainForHistory(assetId);
    }

    private MediaAsset asset(UUID owner, String storageKey, String mimeType, String status) {
        return new MediaAsset(assetId, owner, "CLOUDINARY", storageKey, url, "image.png", mimeType,
                20, 1, 1, null, null, status, "PENDING", "PENDING", Instant.EPOCH, null);
    }
}
