package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.media.MediaAsset;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StickerCatalogServiceTest {
    final StickerRepository repository = mock(StickerRepository.class);
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    final StickerCatalogService catalog = new StickerCatalogService(repository, assets, authorization);
    final UUID actor = UUID.randomUUID(), packId = UUID.randomUUID();

    StickerRepository.Pack pack(UUID id, boolean active) {
        return new StickerRepository.Pack(id, "Expressions", "Uploaded artwork", null, false, active, UUID.randomUUID(), Instant.now());
    }
    MediaAsset asset(UUID id, String status, String type) {
        return new MediaAsset(id, actor, "CLOUDINARY", "image", "https://example.com/sticker.webp", "sticker.webp",
                type, 1000, 128, 128, null, "checksum", status, "PENDING", "PENDING", Instant.now(), null);
    }
    @Test void singleAdminPackReadsAuthorityWithoutScanningDirectoryAndKeepsUnavailableCoverIdentity() {
        UUID coverId = UUID.randomUUID();
        var authority = new StickerRepository.Pack(packId, "Expressions", "Artwork", coverId, false, false, UUID.randomUUID(), Instant.now());
        when(repository.findPack(packId)).thenReturn(authority);
        var view = catalog.adminPack(actor, packId);
        assertThat(view.revision()).isEqualTo(authority.revision());
        assertThat(view.coverAssetId()).isEqualTo(coverId);
        assertThat(view.cover()).isNull();
        verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        verify(repository, never()).packIds(any(), anyInt());
    }
    @Test void singleAdminPackRequiresPermissionBeforeLookup() {
        doThrow(new ForbiddenException("denied")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        assertThatThrownBy(() -> catalog.adminPack(actor, packId)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(repository, assets);
    }
    @Test void singleAdminPackDoesNotInventMissingPack() {
        assertThatThrownBy(() -> catalog.adminPack(actor, packId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> catalog.adminPack(actor, null)).isInstanceOf(BadRequestException.class);
    }
    @Test void singleStickerReadReturnsMatchingPackRevisionWithoutCatalogScan() {
        var current = pack(packId, false);
        UUID stickerId = UUID.randomUUID();
        when(repository.findPack(packId)).thenReturn(current);
        when(repository.findSticker(packId, stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", UUID.randomUUID(), 7, false, UUID.randomUUID()));
        var result = catalog.adminSticker(actor, packId, stickerId);
        assertThat(result.packRevision()).isEqualTo(current.revision());
        assertThat(result.sticker().name()).isEqualTo("Wave");
        assertThat(result.sticker().image()).isNull();
        verify(repository, times(2)).findPack(packId);
        verify(repository, never()).positions(any(), any(), anyInt());
    }
    @Test void singleStickerReadRejectsConcurrentEditAndMissingSticker() {
        UUID stickerId = UUID.randomUUID();
        when(repository.findPack(packId)).thenReturn(pack(packId, true));
        assertThatThrownBy(() -> catalog.adminSticker(actor, packId, stickerId)).isInstanceOf(NotFoundException.class);
        when(repository.findPack(packId)).thenReturn(pack(packId, true), pack(packId, true));
        when(repository.findSticker(packId, stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", UUID.randomUUID(), 7, true, UUID.randomUUID()));
        assertThatThrownBy(() -> catalog.adminSticker(actor, packId, stickerId)).isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);
    }
    @Test void singleStickerReadChecksGlobalPermissionBeforeLookup() {
        doThrow(new ForbiddenException("denied")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        assertThatThrownBy(() -> catalog.adminSticker(actor, packId, UUID.randomUUID())).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(repository, assets);
    }
    @Test void sendableStickerUsesAuthoritativePublishedPackAndReadyArtwork() {
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        when(repository.findSticker(stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 0, true, UUID.randomUUID()));
        when(repository.findPack(packId)).thenReturn(pack(packId, true));
        when(assets.findById(assetId)).thenReturn(asset(assetId, "READY", "image/webp"));
        catalog.requireSendable(stickerId);
        verifyNoInteractions(authorization);
        verify(repository, never()).positions(any(), any(), anyInt());
    }
    @Test void sendingRejectsInactiveMissingOrUnavailableSticker() {
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        assertThatThrownBy(() -> catalog.requireSendable(stickerId)).isInstanceOf(NotFoundException.class);
        when(repository.findSticker(stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 0, false, UUID.randomUUID()));
        assertThatThrownBy(() -> catalog.requireSendable(stickerId)).isInstanceOf(NotFoundException.class);
        when(repository.findSticker(stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 0, true, UUID.randomUUID()));
        when(repository.findPack(packId)).thenReturn(pack(packId, false));
        assertThatThrownBy(() -> catalog.requireSendable(stickerId)).isInstanceOf(NotFoundException.class);
        when(repository.findPack(packId)).thenReturn(pack(packId, true));
        when(assets.findById(assetId)).thenReturn(asset(assetId, "DELETED", "image/webp"));
        assertThatThrownBy(() -> catalog.requireSendable(stickerId)).isInstanceOf(NotFoundException.class);
    }
    @Test void historicalArtworkSurvivesDeactivationButNeverExposesUnsafeImage() {
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        when(repository.findSticker(stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 0, false, UUID.randomUUID()));
        when(assets.findById(assetId)).thenReturn(asset(assetId, "READY", "image/webp"));
        assertThat(catalog.historicalArtwork(stickerId).image().assetId()).isEqualTo(assetId);
        verify(repository, never()).findPack(any());
        when(assets.findById(assetId)).thenReturn(asset(assetId, "DELETED", "image/webp"));
        var unavailable = catalog.historicalArtwork(stickerId);
        assertThat(unavailable.name()).isEqualTo("Wave");
        assertThat(unavailable.image()).isNull();
        verifyNoInteractions(authorization);
    }
    @Test void historicalArtworkDoesNotInventAnOrphanedSticker() {
        assertThatThrownBy(() -> catalog.historicalArtwork(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
    }
    @Test void emptyCatalogIsActuallyEmpty() {
        var page = catalog.packs(actor, false, null, 25);
        assertThat(page.content()).isEmpty();
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }
    @Test void pageCursorUsesLastScannedIdEvenWhenEveryItemIsInactive() {
        UUID second = UUID.randomUUID(), lookahead = UUID.randomUUID();
        when(repository.packIds(null, 3)).thenReturn(List.of(packId, second, lookahead));
        when(repository.findPack(packId)).thenReturn(pack(packId, false));
        when(repository.findPack(second)).thenReturn(pack(second, false));
        var page = catalog.packs(actor, false, null, 2);
        assertThat(page.content()).isEmpty();
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(second.toString());
        verify(repository, never()).findPack(lookahead);
    }
    @Test void inactivePackCannotBeBrowsedFromUserRoute() {
        when(repository.findPack(packId)).thenReturn(pack(packId, false));
        assertThatThrownBy(() -> catalog.stickers(actor, false, packId, null, 25)).isInstanceOf(NotFoundException.class);
        verify(repository, never()).positions(any(), any(), anyInt());
    }
    @Test void adminReadRequiresGlobalPermissionBeforeReadingAnything() {
        doThrow(new ForbiddenException("denied")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        assertThatThrownBy(() -> catalog.packs(actor, true, null, 25)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(repository, assets);
    }
    @Test void adminCanInspectInactivePackButCannotInventAnAvailableImage() {
        when(repository.findPack(packId)).thenReturn(pack(packId, false));
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        when(repository.positions(packId, null, 26)).thenReturn(List.of(new StickerRepository.Position(1, stickerId)));
        when(repository.findSticker(packId, stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 1, false, UUID.randomUUID()));
        when(assets.findById(assetId)).thenReturn(asset(assetId, "DELETED", "image/webp"));
        var item = catalog.stickers(actor, true, packId, null, 25).content().get(0);
        assertThat(item.image()).isNull();
        assertThat(item.isActive()).isFalse();
        verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
    }
    @Test void mismatchedAndStaleOrderingPointersAreNotTrusted() {
        when(repository.findPack(packId)).thenReturn(pack(packId, true));
        UUID wrongPack = UUID.randomUUID(), moved = UUID.randomUUID();
        when(repository.positions(packId, null, 3)).thenReturn(List.of(
                new StickerRepository.Position(1, wrongPack), new StickerRepository.Position(2, moved),
                new StickerRepository.Position(3, UUID.randomUUID())));
        when(repository.findSticker(packId, wrongPack)).thenReturn(new StickerRepository.Sticker(wrongPack, UUID.randomUUID(), "Wrong", UUID.randomUUID(), 1, true, UUID.randomUUID()));
        when(repository.findSticker(packId, moved)).thenReturn(new StickerRepository.Sticker(moved, packId, "Moved", UUID.randomUUID(), 9, true, UUID.randomUUID()));
        var page = catalog.stickers(actor, false, packId, null, 2);
        assertThat(page.content()).isEmpty();
        assertThat(page.nextCursor()).isEqualTo(packId + ":2:" + moved);
        verifyNoInteractions(assets);
    }
    @Test void readyImageAndActiveStickerAreReturnedWithRealDimensions() {
        when(repository.findPack(packId)).thenReturn(pack(packId, true));
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        when(repository.positions(packId, null, 26)).thenReturn(List.of(new StickerRepository.Position(0, stickerId)));
        when(repository.findSticker(packId, stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 0, true, UUID.randomUUID()));
        when(assets.findById(assetId)).thenReturn(asset(assetId, "READY", "image/webp"));
        var item = catalog.stickers(actor, false, packId, null, 25).content().get(0);
        assertThat(item.image().width()).isEqualTo(128);
        assertThat(item.image().url()).isEqualTo("https://example.com/sticker.webp");
        assertThat(item.image().assetId()).isEqualTo(assetId);
    }
    @Test void invalidCursorAndLimitAreRejectedBeforeAnyQuery() {
        assertThatThrownBy(() -> catalog.packs(actor, false, "invalid", 25)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> catalog.packs(actor, false, null, 51)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> catalog.stickers(actor, false, packId, UUID.randomUUID() + ":1:" + UUID.randomUUID(), 25))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository, assets);
    }

    @Test void mismatchedPackAuthorityIsNotUsed() {
        when(repository.findPack(packId)).thenReturn(pack(UUID.randomUUID(), true));
        assertThatThrownBy(() -> catalog.stickers(actor, true, packId, null, 25)).isInstanceOf(NotFoundException.class);
        verify(repository, never()).positions(any(), any(), anyInt());
    }

    @Test void unsafeImageUrlAndRejectedMediaAreNotExposed() {
        when(repository.findPack(packId)).thenReturn(pack(packId, true));
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        when(repository.positions(packId, null, 26)).thenReturn(List.of(new StickerRepository.Position(0, stickerId)));
        when(repository.findSticker(packId, stickerId)).thenReturn(new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 0, true, UUID.randomUUID()));
        for (String url : List.of("javascript:alert(1)", "http://example.com/x", "https://user:pass@example.com/x", "bad url")) {
            when(assets.findById(assetId)).thenReturn(new MediaAsset(assetId, actor, "CLOUDINARY", "image", url,
                    "x.webp", "image/webp", 1000, 128, 128, null, null, "READY", "PENDING", "PENDING", Instant.now(), null));
            assertThat(catalog.stickers(actor, false, packId, null, 25).content()).isEmpty();
        }
        when(assets.findById(assetId)).thenReturn(new MediaAsset(assetId, actor, "CLOUDINARY", "image", "https://example.com/x",
                "x.webp", "image/webp", 1000, 128, 128, null, null, "READY", "INFECTED", "REJECTED", Instant.now(), null));
        assertThat(catalog.stickers(actor, false, packId, null, 25).content()).isEmpty();
    }
}
