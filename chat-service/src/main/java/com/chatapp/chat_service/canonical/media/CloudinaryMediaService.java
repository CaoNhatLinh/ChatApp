package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.cloudinary.Cloudinary;
import com.cloudinary.Transformation;
import com.cloudinary.utils.ObjectUtils;
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

@Service
@ConditionalOnProperty(prefix = "app.integrations.cloudinary", name = "enabled", havingValue = "true")
public class CloudinaryMediaService {
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/webm", "audio/mpeg", "audio/ogg", "audio/wav",
            "application/pdf", "text/plain", "application/zip");

    private final Cloudinary cloudinary;
    private final MediaAssetRepository assets;

    public CloudinaryMediaService(Cloudinary cloudinary, MediaAssetRepository assets) {
        this.cloudinary = cloudinary;
        this.assets = assets;
    }

    public UploadResult upload(UUID ownerId, MultipartFile file) {
        validate(file);
        UUID assetId = UUID.randomUUID();
        try {
            byte[] bytes = file.getBytes();
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(bytes, ObjectUtils.asMap(
                    "resource_type", "auto",
                    "folder", "chatapp/" + ownerId,
                    "public_id", assetId.toString(),
                    "overwrite", false,
                    "use_filename", false));
            String publicId = requiredValue(result, "public_id");
            String publicUrl = requiredValue(result, "secure_url");
            String resourceType = requiredValue(result, "resource_type");
            Integer width = integer(result.get("width"));
            Integer height = integer(result.get("height"));
            Long durationMs = durationMillis(result.get("duration"));
            Instant now = Instant.now();
            MediaAsset asset = new MediaAsset(
                    assetId, ownerId, "CLOUDINARY", publicId, publicUrl, file.getOriginalFilename(),
                    file.getContentType(), bytes.length, width, height, durationMs, sha256(bytes),
                    "READY", "PENDING", "PENDING", now, null);
            assets.save(asset);
            return new UploadResult(
                    assetId, UUID.randomUUID(), publicUrl, file.getOriginalFilename(), bytes.length,
                    file.getContentType(), resourceType, publicId,
                    thumbnailUrl(publicId, resourceType), width, height, durationMs,
                    "CLOUDINARY", publicId);
        } catch (IOException exception) {
            throw new IllegalStateException("Cloudinary upload failed", exception);
        }
    }

    public void delete(UUID actorId, UUID assetId) {
        MediaAsset asset = assets.findById(assetId);
        if (asset == null || "DELETED".equals(asset.uploadStatus())) {
            throw new NotFoundException("media asset not found");
        }
        if (!actorId.equals(asset.ownerId())) {
            throw new ForbiddenException("only the media owner can delete this asset");
        }
        try {
            cloudinary.uploader().destroy(asset.storageKey(), ObjectUtils.asMap(
                    "resource_type", cloudinaryResourceType(asset.mimeType()),
                    "invalidate", true));
            assets.markDeleted(assetId, Instant.now());
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
        if (file.getSize() > 10L * 1024L * 1024L) {
            throw new BadRequestException("file exceeds the 10 MB limit");
        }
        if (!ALLOWED_TYPES.contains(file.getContentType())) {
            throw new BadRequestException("unsupported media type");
        }
    }

    private String thumbnailUrl(String publicId, String resourceType) {
        if (!"image".equals(resourceType)) {
            return null;
        }
        return cloudinary.url()
                .secure(true)
                .transformation(new Transformation<>().width(320).height(320).crop("limit").quality("auto"))
                .generate(publicId);
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
        if (value == null || value.toString().isBlank()) {
            throw new IllegalStateException("Cloudinary response is missing " + key);
        }
        return value.toString();
    }

    private static Integer integer(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static Long durationMillis(Object value) {
        return value instanceof Number number ? Math.round(number.doubleValue() * 1000D) : null;
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
            String storageKey) {
    }
}
