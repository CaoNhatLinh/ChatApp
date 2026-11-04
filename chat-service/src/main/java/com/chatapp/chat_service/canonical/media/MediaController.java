package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@ConditionalOnProperty(prefix = "app.integrations.cloudinary", name = "enabled", havingValue = "true")
public class MediaController {
    private final CloudinaryMediaService media;
    private final SecurityContextHelper securityContext;

    public MediaController(CloudinaryMediaService media, SecurityContextHelper securityContext) {
        this.media = media;
        this.securityContext = securityContext;
    }

    @PostMapping("/upload")
    public ResponseEntity<UploadResponse> upload(@RequestPart("file") MultipartFile file,
                                                @RequestParam(required = false) UUID uploadId,
                                                @RequestParam(defaultValue = "GENERAL") UploadPurpose purpose) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UploadResponse(true, uploadFile(actorId(), uploadId, file, purpose), null));
    }

    @PostMapping("/upload/multiple")
    public ResponseEntity<UploadResponse> uploadMultiple(@RequestPart("files") MultipartFile[] files,
                                                       @RequestParam(required = false) List<UUID> uploadIds,
                                                       @RequestParam(defaultValue = "GENERAL") UploadPurpose purpose) {
        if (files.length == 0 || files.length > 10) {
            throw new BadRequestException("between 1 and 10 files are required");
        }
        if (uploadIds != null && (uploadIds.size() != files.length || uploadIds.stream().distinct().count() != uploadIds.size()
                || uploadIds.stream().anyMatch(id -> id == null || new UUID(0, 0).equals(id)))) {
            throw new BadRequestException("one distinct nonzero uploadId is required for each file");
        }
        UUID actor = actorId();
        List<CloudinaryMediaService.UploadResult> uploaded = java.util.stream.IntStream.range(0, files.length)
                .mapToObj(index -> uploadFile(actor, uploadIds == null ? null : uploadIds.get(index), files[index], purpose))
                .toList();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UploadResponse(true, null, uploaded));
    }

    private CloudinaryMediaService.UploadResult uploadFile(UUID actor, UUID uploadId, MultipartFile file, UploadPurpose purpose) {
        UUID id = uploadId == null ? UUID.randomUUID() : uploadId;
        return purpose == UploadPurpose.COMPOSER ? media.upload(actor, id, file, purpose) : media.upload(actor, id, file);
    }

    @GetMapping("/uploads/{uploadId}")
    public ResponseEntity<CloudinaryMediaService.UploadInspection> inspectUpload(@PathVariable UUID uploadId) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(media.inspectUpload(actorId(), uploadId));
    }

    @DeleteMapping("/{assetId}")
    public ResponseEntity<Void> delete(@PathVariable UUID assetId) {
        media.delete(actorId(), assetId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{assetId}/thumbnails")
    public ResponseEntity<CloudinaryMediaService.ThumbnailView> thumbnails(@PathVariable UUID assetId) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(media.thumbnails(actorId(), assetId));
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }

    public record UploadResponse(
            boolean success,
            CloudinaryMediaService.UploadResult file,
            List<CloudinaryMediaService.UploadResult> uploadedFiles) {
    }
}
