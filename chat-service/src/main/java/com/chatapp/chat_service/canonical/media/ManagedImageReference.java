package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class ManagedImageReference {
    private static final String UUID_PATH = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private static final Pattern MANAGED_KEY = Pattern.compile(
            "(?:.*/)?chatapp/(" + UUID_PATH + ")/(" + UUID_PATH + ")(?:\\.[a-zA-Z0-9]{1,12})?");
    private final MediaAssetRepository assets;
    private final String cloudName;

    public ManagedImageReference(MediaAssetRepository assets, @Value("${cloudinary.cloud-name:}") String cloudName) {
        this.assets = assets;
        this.cloudName = cloudName;
    }

    public void retain(String url) {
        var uri = parse(url);
        if (uri == null || cloudName == null || cloudName.isBlank() || !isSharedCdn(uri.getHost())
                || !isWebUrl(uri) || uri.getRawUserInfo() != null || uri.getPath() == null) return;
        String prefix = "/" + cloudName + "/image/upload/";
        if (!uri.getPath().startsWith(prefix)) return;
        var match = MANAGED_KEY.matcher(uri.getPath().substring(prefix.length()));
        if (!match.matches()) return;

        UUID owner = UUID.fromString(match.group(1)), assetId = UUID.fromString(match.group(2));
        var asset = requireReadyImage(owner, assetId);
        if (!"CLOUDINARY".equals(asset.storageProvider())
                || !("chatapp/" + owner + "/" + assetId).equals(asset.storageKey())) throw unavailable();
        lock(assetId);
    }

    public String retain(UUID owner, UUID assetId, String suppliedUrl) {
        var asset = requireReadyImage(owner, assetId);
        var canonical = parse(asset.publicUrl());
        if (canonical == null || !isWebUrl(canonical)) throw unavailable();
        String url = asset.publicUrl().strip();
        if (suppliedUrl != null && !suppliedUrl.isBlank() && !url.equals(suppliedUrl.strip())) {
            throw new BadRequestException("image URL does not match the uploaded asset");
        }
        lock(assetId);
        return url;
    }

    private MediaAsset requireReadyImage(UUID owner, UUID assetId) {
        var asset = assets.findById(assetId);
        if (asset == null || !assetId.equals(asset.assetId()) || !owner.equals(asset.ownerId())
                || asset.deletedAt() != null || !"READY".equals(asset.uploadStatus())
                || asset.mimeType() == null || !asset.mimeType().startsWith("image/")) throw unavailable();
        return asset;
    }

    private void lock(UUID assetId) {
        if (!assets.retainForHistory(assetId)) throw new ConflictException("image is being deleted or is no longer available");
    }

    private static ForbiddenException unavailable() {
        return new ForbiddenException("image must reference an authorized ready upload");
    }

    private static URI parse(String url) {
        if (url == null || url.isBlank()) return null;
        try { return URI.create(url.strip()); }
        catch (IllegalArgumentException invalid) { return null; }
    }

    private static boolean isWebUrl(URI uri) {
        return uri.getHost() != null && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()));
    }

    private static boolean isSharedCdn(String host) {
        return "res.cloudinary.com".equalsIgnoreCase(host) || "res.cloudinary.com.".equalsIgnoreCase(host);
    }
}
