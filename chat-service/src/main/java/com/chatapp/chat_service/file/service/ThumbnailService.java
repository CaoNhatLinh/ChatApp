package com.chatapp.chat_service.file.service;

import com.chatapp.chat_service.file.entity.FileThumbnail;
import com.chatapp.chat_service.file.repository.FileThumbnailRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ThumbnailService {

    private final FileThumbnailRepository thumbnailRepository;

    /**
     * Create a thumbnail for a file
     */
    public FileThumbnail createThumbnail(UUID fileId, String thumbnailUrl, String thumbnailType,
                                         int thumbnailSize, Integer width, Integer height,
                                         Long fileSize, String fileType) {
        FileThumbnail.FileThumbnailKey key = new FileThumbnail.FileThumbnailKey(fileId, thumbnailType);

        FileThumbnail thumbnail = FileThumbnail.builder()
                .key(key)
                .thumbnailUrl(thumbnailUrl)
                .thumbnailSize(thumbnailSize)
                .thumbnailWidth(width)
                .thumbnailHeight(height)
                .thumbnailType(thumbnailType)
                .createdAt(Instant.now())
                .fileSize(fileSize)
                .fileType(fileType)
                .build();

        FileThumbnail saved = thumbnailRepository.save(thumbnail);
        log.info("Thumbnail created for file {} with type {}", fileId, thumbnailType);
        return saved;
    }

    /**
     * Get all thumbnails for a file
     */
    public List<FileThumbnail> getThumbnails(UUID fileId) {
        return thumbnailRepository.findByFileId(fileId);
    }

    /**
     * Get a specific thumbnail type for a file
     */
    public FileThumbnail getThumbnail(UUID fileId, String thumbnailType) {
        return thumbnailRepository.findByFileIdAndThumbnailType(fileId, thumbnailType);
    }

    /**
     * Get the best thumbnail based on requested size
     */
    public FileThumbnail getBestThumbnail(UUID fileId, String requestedSize) {
        List<FileThumbnail> thumbnails = thumbnailRepository.findByFileId(fileId);

        if (thumbnails.isEmpty()) {
            return null;
        }

        // Priority: requested size > medium > small > large
        FileThumbnail exactMatch = thumbnails.stream()
                .filter(t -> t.getThumbnailType().equalsIgnoreCase(requestedSize))
                .findFirst()
                .orElse(null);

        if (exactMatch != null) {
            return exactMatch;
        }

        // Fallback to medium
        FileThumbnail medium = thumbnails.stream()
                .filter(t -> t.getThumbnailType().equalsIgnoreCase("MEDIUM"))
                .findFirst()
                .orElse(null);

        if (medium != null) {
            return medium;
        }

        // Fallback to small
        FileThumbnail small = thumbnails.stream()
                .filter(t -> t.getThumbnailType().equalsIgnoreCase("SMALL"))
                .findFirst()
                .orElse(null);

        if (small != null) {
            return small;
        }

        // Return any available
        return thumbnails.get(0);
    }

    /**
     * Delete all thumbnails for a file
     */
    public void deleteThumbnails(UUID fileId) {
        thumbnailRepository.deleteByFileId(fileId);
        log.info("All thumbnails deleted for file {}", fileId);
    }

    /**
     * Delete a specific thumbnail
     */
    public void deleteThumbnail(UUID fileId, String thumbnailType) {
        thumbnailRepository.deleteByFileIdAndThumbnailType(fileId, thumbnailType);
        log.info("Thumbnail {} deleted for file {}", thumbnailType, fileId);
    }

    /**
     * Check if file has thumbnails
     */
    public boolean hasThumbnails(UUID fileId) {
        List<FileThumbnail> thumbnails = thumbnailRepository.findByFileId(fileId);
        return !thumbnails.isEmpty();
    }
}
