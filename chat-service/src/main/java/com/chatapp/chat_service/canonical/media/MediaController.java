package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
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
    public ResponseEntity<UploadResponse> upload(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UploadResponse(true, media.upload(actorId(), file), null));
    }

    @PostMapping("/upload/multiple")
    public ResponseEntity<UploadResponse> uploadMultiple(@RequestPart("files") MultipartFile[] files) {
        if (files.length == 0 || files.length > 10) {
            throw new BadRequestException("between 1 and 10 files are required");
        }
        List<CloudinaryMediaService.UploadResult> uploaded = Arrays.stream(files)
                .map(file -> media.upload(actorId(), file))
                .toList();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UploadResponse(true, null, uploaded));
    }

    @DeleteMapping("/{assetId}")
    public ResponseEntity<Void> delete(@PathVariable UUID assetId) {
        media.delete(actorId(), assetId);
        return ResponseEntity.noContent().build();
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
