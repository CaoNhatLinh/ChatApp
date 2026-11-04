package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.List;
import java.util.Objects;
import java.time.temporal.ChronoUnit;

@Service
@ConditionalOnProperty(prefix = "app.integrations.cloudinary", name = "enabled", havingValue = "true")
public class CloudinaryMediaService {
    private static final Logger log = LoggerFactory.getLogger(CloudinaryMediaService.class);
    private static final int MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/webm", "audio/mpeg", "audio/ogg", "audio/wav",
            "application/pdf", "text/plain", "application/zip");

    private final Cloudinary cloudinary;
    private final MediaAssetRepository assets;
    private final MediaUploadRecoveryRepository recovery;
    private final MediaDeletionRecoveryRepository deletions;
    private final MediaOrphanRepository orphans;

    public CloudinaryMediaService(Cloudinary cloudinary, MediaAssetRepository assets,
                                  MediaUploadRecoveryRepository recovery, MediaDeletionRecoveryRepository deletions,
                                  MediaOrphanRepository orphans) {
        this.cloudinary = cloudinary;
        this.assets = assets;
        this.recovery = recovery;
        this.deletions = deletions;
        this.orphans = orphans;
    }

    public UploadResult upload(UUID ownerId, MultipartFile file) {
        return upload(ownerId, UUID.randomUUID(), file);
    }

    public UploadResult upload(UUID ownerId, UUID uploadId, MultipartFile file) {
        return upload(ownerId, uploadId, file, UploadPurpose.GENERAL);
    }

    public UploadResult upload(UUID ownerId, UUID uploadId, MultipartFile file, UploadPurpose purpose) {
        validate(file);
        MediaUploadIdentity identity = MediaUploadIdentity.of(ownerId, uploadId);
        byte[] bytes = validatedBytes(file);
        MediaAsset proposed = new MediaAsset(identity.assetId(), ownerId, "CLOUDINARY", identity.storageKey(ownerId, file.getContentType()),
                null, file.getOriginalFilename(), file.getContentType(), bytes.length, null, null, null, sha256(bytes),
                "PENDING", "PENDING", "PENDING", Instant.now().truncatedTo(ChronoUnit.MILLIS), null,
                purpose == UploadPurpose.COMPOSER ? purpose.name() : null);
        var work = new MediaUploadRecoveryRepository.Work(identity.assetId(), ownerId, uploadId);
        recovery.register(work);
        if (purpose == UploadPurpose.COMPOSER) orphans.register(new MediaOrphanRepository.Work(identity.assetId(), ownerId));
        MediaAsset current = assets.claimUpload(proposed) ? proposed : assets.findById(identity.assetId());
        if (current == null) throw new IllegalStateException("upload claim cannot be confirmed");
        if (!sameIntent(proposed, current)) throw new ConflictException("uploadId is already bound to different file data");
        if (purpose != UploadPurpose.COMPOSER && "COMPOSER".equals(current.uploadPurpose())) {
            throw new ConflictException("uploadId is reserved for the message composer");
        }
        if (current.deletedAt() != null) throw new ConflictException("upload is not available");
        if ("PENDING".equals(current.uploadStatus())) {
            uploadPending(identity, current, bytes);
            current = assets.findById(identity.assetId());
        }
        var result = replay(identity, current);
        try {
            recovery.remove(work);
        } catch (RuntimeException failure) {
            log.warn("Media upload recovery cleanup deferred: {}", failure.getClass().getSimpleName());
        }
        return result;
    }

    private byte[] validatedBytes(MultipartFile file) {
        try {
            byte[] bytes;
            try (var input = file.getInputStream()) {
                bytes = input.readNBytes(MAX_UPLOAD_BYTES + 1);
            }
            if (bytes.length == 0 || bytes.length > MAX_UPLOAD_BYTES) {
                throw new BadRequestException("file must contain between 1 byte and 10 MB");
            }
            ImageUploadPreflight.validate(bytes, file.getContentType());
            return bytes;
        } catch (IOException exception) { throw new IllegalStateException("cannot read upload", exception); }
    }

    private static boolean sameIntent(MediaAsset expected, MediaAsset current) {
        return expected.ownerId().equals(current.ownerId()) && expected.assetId().equals(current.assetId())
                && Objects.equals(expected.storageProvider(), current.storageProvider())
                && expected.storageKey().equals(current.storageKey()) && expected.fileName().equals(current.fileName())
                && expected.mimeType().equals(current.mimeType()) && expected.byteSize() == current.byteSize()
                && expected.checksumSha256().equals(current.checksumSha256());
    }

    private void uploadPending(MediaUploadIdentity identity, MediaAsset pending, byte[] bytes) {
        try {
            String requestedType = cloudinaryResourceType(pending.mimeType());
            Map<String, Object> options = ObjectUtils.asMap(
                    "resource_type", requestedType, "public_id", pending.storageKey(), "overwrite", false, "use_filename", false);
            CloudinaryUploadProof.bind(cloudinary, options, pending);
            if ("image".equals(requestedType)) {
                options.put("eager", CloudinaryThumbnailPolicy.eagerTransformations());
                options.put("eager_async", false);
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(bytes, options);
            assets.completeUpload(providerReceipt(identity, pending, requestedType, result, result.get("eager")));
        } catch (IOException exception) {
            throw new IllegalStateException("Cloudinary upload failed", exception);
        }
    }

    private MediaUploadReceipt providerReceipt(MediaUploadIdentity identity, MediaAsset pending, String requestedType,
                                               Map<String, Object> result, Object eager) {
        String publicId = requiredValue(result, "public_id");
        String publicUrl = requiredValue(result, "secure_url");
        String resourceType = requiredValue(result, "resource_type");
        if (!pending.storageKey().equals(publicId) || !requestedType.equals(resourceType) || !validOriginalUrl(publicUrl, requestedType, publicId)) {
            throw new IllegalStateException("Cloudinary returned invalid asset metadata");
        }
        Integer width = CloudinaryThumbnailPolicy.positiveInteger(result.get("width"));
        Integer height = CloudinaryThumbnailPolicy.positiveInteger(result.get("height"));
        if ("image".equals(resourceType) && (width == null || height == null
                || width > ImageUploadPreflight.MAX_EDGE || height > ImageUploadPreflight.MAX_EDGE
                || (long) width * height > ImageUploadPreflight.MAX_PIXELS)) {
            throw new IllegalStateException("Cloudinary returned invalid image dimensions");
        }
        Long durationMs = durationMillis(result.get("duration"));
        Instant now = Instant.now();
        MediaAsset asset = new MediaAsset(
                pending.assetId(), pending.ownerId(), "CLOUDINARY", publicId, publicUrl, pending.fileName(),
                pending.mimeType(), pending.byteSize(), width, height, durationMs, pending.checksumSha256(),
                "READY", "PENDING", "PENDING", pending.createdAt(), null, pending.uploadPurpose());
        List<MediaThumbnail> thumbnails = "image".equals(resourceType)
                ? CloudinaryThumbnailPolicy.read(eager, publicUrl, publicId, now) : List.of();
        return new MediaUploadReceipt(asset, identity.attachmentId(), thumbnails);
    }

    boolean recoverPendingUpload(MediaUploadRecoveryRepository.Work work, MediaAsset pending) {
        var identity = MediaUploadIdentity.of(work.ownerId(), work.uploadId());
        if (!"PENDING".equals(pending.uploadStatus()) || pending.deletedAt() != null
                || !"CLOUDINARY".equals(pending.storageProvider()) || !identity.assetId().equals(pending.assetId())
                || !work.ownerId().equals(pending.ownerId())
                || !identity.storageKey(work.ownerId(), pending.mimeType()).equals(pending.storageKey())) return false;
        var resourceType = cloudinaryResourceType(pending.mimeType());
        Map<String, Object> result;
        try {
            result = CloudinaryUploadProof.read(cloudinary, pending, resourceType);
        } catch (Exception failure) {
            throw new IllegalStateException("Cloudinary upload lookup failed", failure);
        }
        if (result == null) return false;
        // The Admin API metadata does not prove that any eager derivatives completed.
        assets.completeUpload(providerReceipt(identity, pending, resourceType, result, null));
        var winner = assets.findById(work.assetId());
        if (winner == null || !"READY".equals(winner.uploadStatus()) || winner.deletedAt() != null) return false;
        assets.repairUploadThumbnails(confirmedReceipt(identity, winner));
        return true;
    }

    private UploadResult replay(MediaUploadIdentity identity, MediaAsset current) {
        MediaUploadReceipt receipt = confirmedReceipt(identity, current);
        assets.repairUploadThumbnails(receipt);
        return result(receipt);
    }

    void repairReadyUpload(MediaUploadRecoveryRepository.Work work, MediaAsset current) {
        var identity = MediaUploadIdentity.of(work.ownerId(), work.uploadId());
        assets.repairUploadThumbnails(confirmedReceipt(identity, current));
    }

    private MediaUploadReceipt confirmedReceipt(MediaUploadIdentity identity, MediaAsset current) {
        if (current == null) throw new IllegalStateException("upload authority cannot be confirmed");
        if (!"READY".equals(current.uploadStatus()) || current.deletedAt() != null) throw new ConflictException("upload is not available");
        MediaUploadReceipt receipt = assets.findUploadReceipt(identity.assetId());
        if (receipt == null || !identity.attachmentId().equals(receipt.attachmentId()) || !receipt.matches(current)) {
            throw new IllegalStateException("upload receipt does not match authority");
        }
        if (!validOriginalUrl(current.publicUrl(), cloudinaryResourceType(current.mimeType()), current.storageKey())) {
            throw new IllegalStateException("upload receipt contains an invalid provider URL");
        }
        return receipt;
    }

    private boolean validOriginalUrl(String url, String resourceType, String publicId) {
        return CloudinaryUploadUrl.matches(url, cloudinary.config == null ? null : cloudinary.config.cloudName, resourceType, publicId);
    }

    private static UploadResult result(MediaUploadReceipt receipt) {
        MediaAsset asset = receipt.asset();
        return new UploadResult(asset.assetId(), receipt.attachmentId(), asset.publicUrl(), asset.fileName(), asset.byteSize(),
                asset.mimeType(), cloudinaryResourceType(asset.mimeType()), asset.storageKey(),
                receipt.thumbnails().stream().filter(thumbnail -> thumbnail.variant() == MediaThumbnail.Variant.SMALL
                        && thumbnail.status() == MediaThumbnail.Status.READY).map(MediaThumbnail::url).findFirst().orElse(null),
                asset.width(), asset.height(), asset.durationMs(), asset.storageProvider(), asset.storageKey(), receipt.thumbnails());
    }

    public UploadInspection inspectUpload(UUID ownerId, UUID uploadId) {
        MediaUploadIdentity identity = MediaUploadIdentity.of(ownerId, uploadId);
        MediaAsset current = assets.findById(identity.assetId());
        if (current == null || !ownerId.equals(current.ownerId())) throw new NotFoundException("upload not found");
        UploadState state = UploadState.valueOf(current.uploadStatus());
        return new UploadInspection(uploadId, state, state == UploadState.READY ? result(confirmedReceipt(identity, current)) : null);
    }

    public void delete(UUID actorId, UUID assetId) {
        MediaAsset asset = assets.findById(assetId);
        if (asset == null || "DELETED".equals(asset.uploadStatus())) {
            throw new NotFoundException("media asset not found");
        }
        if (!actorId.equals(asset.ownerId())) {
            throw new ForbiddenException("only the media owner can delete this asset");
        }
        if (!Set.of("READY", "DELETING").contains(asset.uploadStatus())) {
            throw new ConflictException("media is not available for deletion");
        }
        var work = new MediaDeletionRecoveryRepository.Work(assetId, actorId);
        deletions.register(work);
        if ("READY".equals(asset.uploadStatus())) {
            if (!assets.claimDeletion(assetId)) {
                throw new ConflictException("media is retained for history or no longer available for deletion");
            }
            asset = assets.findById(assetId);
        }
        if (asset == null || !actorId.equals(asset.ownerId())) throw new IllegalStateException("media deletion authority changed");
        if (!"DELETED".equals(asset.uploadStatus())) finishDeletion(asset);
        try {
            deletions.remove(work);
        } catch (RuntimeException failure) {
            log.warn("Media deletion recovery cleanup deferred: {}", failure.getClass().getSimpleName());
        }
    }

    void finishDeletion(MediaAsset asset) {
        if (!"DELETING".equals(asset.uploadStatus()) || !"CLOUDINARY".equals(asset.storageProvider())
                || asset.storageKey() == null || asset.storageKey().isBlank()) {
            throw new IllegalStateException("media deletion is not authorized by its current state");
        }
        try {
            Map<?, ?> result = cloudinary.uploader().destroy(asset.storageKey(), ObjectUtils.asMap(
                    "resource_type", cloudinaryResourceType(asset.mimeType()),
                    "type", "upload",
                    "invalidate", true));
            if (!Set.of("ok", "not found").contains(result.get("result"))) {
                throw new IllegalStateException("Cloudinary deletion was not confirmed");
            }
            if (!assets.markDeleted(asset.assetId(), Instant.now())) {
                var current = assets.findById(asset.assetId());
                if (current == null || !"DELETED".equals(current.uploadStatus())) {
                    throw new IllegalStateException("media deletion could not be confirmed");
                }
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Cloudinary delete failed", exception);
        }
    }

    private static String cloudinaryResourceType(String mimeType) {
        if (mimeType != null && mimeType.startsWith("image/")) {
            return "image";
        }
        if (mimeType != null && (mimeType.startsWith("video/") || mimeType.startsWith("audio/"))) {
            return "video";
        }
        return "raw";
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new BadRequestException("file exceeds the 10 MB limit");
        }
        if (file.getContentType() == null || !ALLOWED_TYPES.contains(file.getContentType())) {
            throw new BadRequestException("unsupported media type");
        }
    }

    public ThumbnailView thumbnails(UUID actorId, UUID assetId) {
        MediaAsset asset = assets.findById(assetId);
        if (asset == null || asset.deletedAt() != null || !"READY".equals(asset.uploadStatus())) {
            throw new NotFoundException("media asset not found");
        }
        if (!actorId.equals(asset.ownerId())) throw new ForbiddenException("only the media owner can inspect this upload");
        boolean applicable = asset.mimeType().startsWith("image/");
        return new ThumbnailView(assetId, applicable, applicable ? assets.findThumbnails(assetId) : List.of());
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String requiredValue(Map<String, Object> result, String key) {
        Object value = result.get(key);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalStateException("Cloudinary response is missing " + key);
        }
        return text;
    }

    private static Long durationMillis(Object value) {
        if (value == null) return null;
        if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue()) || number.doubleValue() < 0
                || number.doubleValue() * 1000D >= Long.MAX_VALUE) {
            throw new IllegalStateException("Cloudinary returned invalid media duration");
        }
        return Math.round(number.doubleValue() * 1000D);
    }

    public record UploadResult(
            UUID assetId,
            UUID attachmentId,
            String url,
            String fileName,
            long fileSize,
            String contentType,
            String resourceType,
            String publicId,
            String thumbnailUrl,
            Integer width,
            Integer height,
            Long durationMs,
            String storageProvider,
            String storageKey,
            List<MediaThumbnail> thumbnails) {
    }

    public record ThumbnailView(UUID assetId, boolean applicable, List<MediaThumbnail> variants) {
        public ThumbnailView { variants = List.copyOf(variants); }
    }
    public enum UploadState { PENDING, READY, QUARANTINED, DELETING, DELETED }
    public record UploadInspection(UUID uploadId, UploadState status, UploadResult file) {}
}
