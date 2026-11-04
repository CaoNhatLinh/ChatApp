package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class StickerCatalogService {
    private final StickerRepository repository;
    private final MediaAssetRepository assets;
    private final AppAuthorizationService authorization;

    public StickerCatalogService(StickerRepository repository, MediaAssetRepository assets, AppAuthorizationService authorization) {
        this.repository = repository;
        this.assets = assets;
        this.authorization = authorization;
    }

    public Page<PackView> packs(UUID actor, boolean admin, String cursor, int limit) {
        requireActor(actor, admin);
        requireLimit(limit);
        UUID after = cursor == null ? null : parseId(cursor);
        List<UUID> ids = repository.packIds(after, limit + 1);
        boolean hasNext = ids.size() > limit;
        int scanned = Math.min(ids.size(), limit);
        var content = new ArrayList<PackView>();
        for (UUID id : ids.subList(0, scanned)) {
            var pack = repository.findPack(id);
            if (pack == null || !id.equals(pack.stickerPackId()) || (!admin && !pack.isActive())) continue;
            content.add(new PackView(pack.stickerPackId(), pack.name(), pack.description(), pack.coverAssetId(), image(pack.coverAssetId()),
                    pack.isOfficial(), pack.isActive(), pack.revision(), pack.updatedAt()));
        }
        return new Page<>(List.copyOf(content), hasNext ? ids.get(scanned - 1).toString() : null, hasNext);
    }

    public PackView adminPack(UUID actor, UUID packId) {
        requireActor(actor, true);
        if (packId == null) throw new BadRequestException("stickerPackId is required");
        var pack = repository.findPack(packId);
        if (pack == null || !packId.equals(pack.stickerPackId())) throw new NotFoundException("sticker pack not found");
        return new PackView(pack.stickerPackId(), pack.name(), pack.description(), pack.coverAssetId(), image(pack.coverAssetId()),
                pack.isOfficial(), pack.isActive(), pack.revision(), pack.updatedAt());
    }

    public void requireSendable(UUID stickerId) {
        var sticker = stickerId == null ? null : repository.findSticker(stickerId);
        if (sticker == null || !stickerId.equals(sticker.stickerId()) || !sticker.isActive())
            throw new NotFoundException("sticker is unavailable");
        var pack = repository.findPack(sticker.stickerPackId());
        if (pack == null || !sticker.stickerPackId().equals(pack.stickerPackId()) || !pack.isActive()
                || image(sticker.assetId()) == null) throw new NotFoundException("sticker is unavailable");
    }

    /** Caller must prove access to a nondeleted message referencing this immutable sticker identity. */
    public StickerArtworkView historicalArtwork(UUID stickerId) {
        var sticker = stickerId == null ? null : repository.findSticker(stickerId);
        if (sticker == null || !stickerId.equals(sticker.stickerId())) throw new NotFoundException("sticker artwork not found");
        return new StickerArtworkView(sticker.stickerId(), sticker.name(), image(sticker.assetId()));
    }

    public AdminStickerView adminSticker(UUID actor, UUID packId, UUID stickerId) {
        requireActor(actor, true);
        if (packId == null || stickerId == null) throw new BadRequestException("pack and sticker IDs are required");
        var before = repository.findPack(packId);
        if (before == null || !packId.equals(before.stickerPackId())) throw new NotFoundException("sticker pack not found");
        var sticker = repository.findSticker(packId, stickerId);
        if (sticker == null || !packId.equals(sticker.stickerPackId()) || !stickerId.equals(sticker.stickerId()))
            throw new NotFoundException("sticker not found");
        var after = repository.findPack(packId);
        if (after == null || !before.revision().equals(after.revision()))
            throw new ConflictException("sticker pack changed during reload; try again");
        return new AdminStickerView(before.revision(), new StickerView(sticker.stickerId(), packId, sticker.name(),
                sticker.sortOrder(), sticker.isActive(), sticker.revision(), image(sticker.assetId())));
    }

    public Page<StickerView> stickers(UUID actor, boolean admin, UUID packId, String cursor, int limit) {
        requireActor(actor, admin);
        requireLimit(limit);
        if (packId == null) throw new BadRequestException("stickerPackId is required");
        var after = position(packId, cursor);
        var pack = repository.findPack(packId);
        if (pack == null || !packId.equals(pack.stickerPackId()) || (!admin && !pack.isActive()))
            throw new NotFoundException("sticker pack not found");
        var positions = repository.positions(packId, after, limit + 1);
        boolean hasNext = positions.size() > limit;
        int scanned = Math.min(positions.size(), limit);
        var content = new ArrayList<StickerView>();
        for (var position : positions.subList(0, scanned)) {
            var sticker = repository.findSticker(packId, position.stickerId());
            if (sticker == null || !Objects.equals(sticker.stickerId(), position.stickerId())
                    || !Objects.equals(sticker.stickerPackId(), packId) || sticker.sortOrder() != position.sortOrder()
                    || (!admin && !sticker.isActive())) continue;
            var image = image(sticker.assetId());
            if (!admin && image == null) continue;
            content.add(new StickerView(sticker.stickerId(), sticker.stickerPackId(), sticker.name(),
                    sticker.sortOrder(), sticker.isActive(), sticker.revision(), image));
        }
        var last = scanned == 0 ? null : positions.get(scanned - 1);
        return new Page<>(List.copyOf(content), hasNext ? packId + ":" + last.sortOrder() + ":" + last.stickerId() : null, hasNext);
    }

    private ImageView image(UUID assetId) {
        if (assetId == null) return null;
        var asset = assets.findById(assetId);
        if (asset == null || !assetId.equals(asset.assetId()) || asset.deletedAt() != null
                || !"READY".equals(asset.uploadStatus()) || asset.mimeType() == null
                || !java.util.Set.of("image/png", "image/webp", "image/jpeg", "image/gif").contains(asset.mimeType())
                || "INFECTED".equals(asset.malwareScanStatus()) || "REJECTED".equals(asset.moderationStatus())
                || asset.width() == null || asset.height() == null || asset.width() < 1 || asset.height() < 1) return null;
        try {
            URI url = URI.create(asset.publicUrl());
            if (!"https".equals(url.getScheme()) || url.getHost() == null || url.getUserInfo() != null) return null;
        } catch (IllegalArgumentException | NullPointerException exception) { return null; }
        return new ImageView(asset.assetId(), asset.publicUrl(), asset.mimeType(), asset.width(), asset.height());
    }

    private void requireActor(UUID actor, boolean admin) {
        if (actor == null) throw new BadRequestException("authenticated actor is required");
        if (admin) authorization.require(actor, AppPermission.SYSTEM_OPERATE);
    }
    private void requireLimit(int limit) {
        if (limit < 1 || limit > 50) throw new BadRequestException("limit must be between 1 and 50");
    }
    private UUID parseId(String value) {
        try {
            UUID id = UUID.fromString(value);
            if (!id.toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return id;
        } catch (IllegalArgumentException exception) { throw new BadRequestException("invalid sticker cursor"); }
    }
    private StickerRepository.Position position(UUID packId, String cursor) {
        if (cursor == null) return null;
        if (cursor.length() > 100) throw new BadRequestException("invalid sticker cursor");
        String[] parts = cursor.split(":", -1);
        if (parts.length != 3 || !packId.equals(parseId(parts[0]))) throw new BadRequestException("invalid sticker cursor");
        try {
            int order = Integer.parseInt(parts[1]);
            if (order < 0) throw new IllegalArgumentException();
            return new StickerRepository.Position(order, parseId(parts[2]));
        } catch (IllegalArgumentException exception) { throw new BadRequestException("invalid sticker cursor"); }
    }

    public record Page<T>(List<T> content, String nextCursor, boolean hasNext) { }
    public record ImageView(UUID assetId, String url, String mimeType, int width, int height) { }
    public record PackView(UUID stickerPackId, String name, String description, UUID coverAssetId, ImageView cover,
                           boolean isOfficial, boolean isActive, UUID revision, Instant updatedAt) { }
    public record StickerView(UUID stickerId, UUID stickerPackId, String name, int sortOrder,
                              boolean isActive, UUID revision, ImageView image) { }
    public record AdminStickerView(UUID packRevision, StickerView sticker) { }
    public record StickerArtworkView(UUID stickerId, String name, ImageView image) { }
}
