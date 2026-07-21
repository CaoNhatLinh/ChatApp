package com.chatapp.chat_service.file.controller;

import com.chatapp.chat_service.file.entity.FileThumbnail;
import com.chatapp.chat_service.file.service.ThumbnailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/thumbnails")
@RequiredArgsConstructor
public class ThumbnailController {

    private final ThumbnailService thumbnailService;

    /**
     * Create a thumbnail for a file
     */
    @PostMapping
    public ResponseEntity<FileThumbnail> createThumbnail(
            @RequestParam UUID fileId,
            @RequestParam String thumbnailUrl,
            @RequestParam String thumbnailType,
            @RequestParam int thumbnailSize,
            @RequestParam(required = false) Integer width,
            @RequestParam(required = false) Integer height,
            @RequestParam(required = false) Long fileSize,
            @RequestParam(required = false) String fileType) {

        FileThumbnail thumbnail = thumbnailService.createThumbnail(
                fileId, thumbnailUrl, thumbnailType, thumbnailSize, width, height, fileSize, fileType);
        return ResponseEntity.ok(thumbnail);
    }

    /**
     * Get all thumbnails for a file
     */
    @GetMapping("/{fileId}")
    public ResponseEntity<List<FileThumbnail>> getThumbnails(@PathVariable UUID fileId) {
        List<FileThumbnail> thumbnails = thumbnailService.getThumbnails(fileId);
        return ResponseEntity.ok(thumbnails);
    }

    /**
     * Get a specific thumbnail type for a file
     */
    @GetMapping("/{fileId}/{thumbnailType}")
    public ResponseEntity<FileThumbnail> getThumbnail(
            @PathVariable UUID fileId,
            @PathVariable String thumbnailType) {

        FileThumbnail thumbnail = thumbnailService.getThumbnail(fileId, thumbnailType);
        if (thumbnail == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(thumbnail);
    }

    /**
     * Get the best thumbnail based on requested size
     */
    @GetMapping("/{fileId}/best/{requestedSize}")
    public ResponseEntity<FileThumbnail> getBestThumbnail(
            @PathVariable UUID fileId,
            @PathVariable String requestedSize) {

        FileThumbnail thumbnail = thumbnailService.getBestThumbnail(fileId, requestedSize);
        if (thumbnail == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(thumbnail);
    }

    /**
     * Check if file has thumbnails
     */
    @GetMapping("/{fileId}/check")
    public ResponseEntity<Map<String, Boolean>> checkThumbnails(@PathVariable UUID fileId) {
        boolean hasThumbnails = thumbnailService.hasThumbnails(fileId);
        return ResponseEntity.ok(Map.of("hasThumbnails", hasThumbnails));
    }

    /**
     * Delete all thumbnails for a file
     */
    @DeleteMapping("/{fileId}")
    public ResponseEntity<Void> deleteThumbnails(@PathVariable UUID fileId) {
        thumbnailService.deleteThumbnails(fileId);
        return ResponseEntity.ok().build();
    }

    /**
     * Delete a specific thumbnail
     */
    @DeleteMapping("/{fileId}/{thumbnailType}")
    public ResponseEntity<Void> deleteThumbnail(
            @PathVariable UUID fileId,
            @PathVariable String thumbnailType) {

        thumbnailService.deleteThumbnail(fileId, thumbnailType);
        return ResponseEntity.ok().build();
    }
}
