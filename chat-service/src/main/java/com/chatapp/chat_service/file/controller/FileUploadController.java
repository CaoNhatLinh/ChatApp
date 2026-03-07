package com.chatapp.chat_service.file.controller;

import com.chatapp.chat_service.file.service.FileUploadService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;

import java.util.*;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class FileUploadController {

    private final FileUploadService fileUploadService;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"
    );
    
    private static final Set<String> ALLOWED_VIDEO_TYPES = Set.of(
        "video/mp4", "video/avi", "video/mov", "video/wmv", "video/webm"
    );
    
    private static final Set<String> ALLOWED_AUDIO_TYPES = Set.of(
        "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac"
    );
    
    private static final Set<String> ALLOWED_DOCUMENT_TYPES = Set.of(
        "application/pdf", 
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    );

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @RequestParam("file") MultipartFile file,UUID userId
           ) {
        
        try {

            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            String validationError = validateFile(file);
            if (validationError != null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", validationError));
            }

            FileUploadService.FileUploadResult result = fileUploadService.uploadFile(file, userId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("file", Map.of(
                "url", result.getUrl(),
                "fileName", result.getFileName(),
                "fileSize", result.getFileSize(),
                "contentType", result.getContentType(),
                "resourceType", result.getResourceType(),
                "publicId", result.getPublicId(),
                "format", result.getFormat()
            ));

            if ("image".equals(result.getResourceType())) {
                String thumbnailUrl = fileUploadService.generateOptimizedUrl(
                    result.getPublicId(), 
                    result.getResourceType(), 
                    FileUploadService.OptimizationOptions.thumbnail()
                );
                
                String mediumUrl = fileUploadService.generateOptimizedUrl(
                    result.getPublicId(), 
                    result.getResourceType(), 
                    FileUploadService.OptimizationOptions.medium()
                );

                @SuppressWarnings("unchecked")
                Map<String, Object> fileInfo = (Map<String, Object>) response.get("file");
                fileInfo.put("thumbnailUrl", thumbnailUrl);
                fileInfo.put("mediumUrl", mediumUrl);
            }

            log.info("File uploaded successfully for user {}: {}", userId, result.getFileName());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error uploading file: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    @PostMapping("/upload/multiple")
    public ResponseEntity<Map<String, Object>> uploadMultipleFiles(
            @RequestParam("files") MultipartFile[] files,
            Authentication authentication) {
        
        try {
            UUID userId = extractUserIdFromAuthentication(authentication);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            List<Map<String, Object>> uploadedFiles = new ArrayList<>();
            List<String> errors = new ArrayList<>();

            for (MultipartFile file : files) {
                try {
                    String validationError = validateFile(file);
                    if (validationError != null) {
                        errors.add(file.getOriginalFilename() + ": " + validationError);
                        continue;
                    }

                    FileUploadService.FileUploadResult result = fileUploadService.uploadFile(file, userId);

                    Map<String, Object> fileInfo = new HashMap<>();
                    fileInfo.put("url", result.getUrl());
                    fileInfo.put("fileName", result.getFileName());
                    fileInfo.put("fileSize", result.getFileSize());
                    fileInfo.put("contentType", result.getContentType());
                    fileInfo.put("resourceType", result.getResourceType());
                    fileInfo.put("publicId", result.getPublicId());
                    fileInfo.put("format", result.getFormat());

                    if ("image".equals(result.getResourceType())) {
                        String thumbnailUrl = fileUploadService.generateOptimizedUrl(
                            result.getPublicId(), 
                            result.getResourceType(), 
                            FileUploadService.OptimizationOptions.thumbnail()
                        );
                        
                        String mediumUrl = fileUploadService.generateOptimizedUrl(
                            result.getPublicId(), 
                            result.getResourceType(), 
                            FileUploadService.OptimizationOptions.medium()
                        );

                        fileInfo.put("thumbnailUrl", thumbnailUrl);
                        fileInfo.put("mediumUrl", mediumUrl);
                    }

                    uploadedFiles.add(fileInfo);

                } catch (Exception e) {
                    errors.add(file.getOriginalFilename() + ": " + e.getMessage());
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", !uploadedFiles.isEmpty());
            response.put("uploadedFiles", uploadedFiles);
            response.put("uploadedCount", uploadedFiles.size());
            response.put("totalFiles", files.length);
            
            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }

            log.info("Multiple files upload completed for user {}: {} successful, {} errors", 
                userId, uploadedFiles.size(), errors.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error uploading multiple files: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    @DeleteMapping("/delete/{publicId}")
    public ResponseEntity<Map<String, Object>> deleteFile(
            @PathVariable String publicId,
            @RequestParam(required = false) String resourceType,
            Authentication authentication) {
        
        try {
            UUID userId = extractUserIdFromAuthentication(authentication);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
            }

            if (!publicId.contains(userId.toString())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You can only delete your own files"));
            }

            boolean deleted = fileUploadService.deleteFile(publicId, resourceType);

            Map<String, Object> response = new HashMap<>();
            response.put("success", deleted);
            response.put("message", deleted ? "File deleted successfully" : "File deletion failed");

            log.info("File deletion attempt for user {}: {} - {}", userId, publicId, deleted ? "success" : "failed");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error deleting file: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Delete failed: " + e.getMessage()));
        }
    }

    /**
     * Validate uploaded file
     */
    private String validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            return "File is empty";
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            return "File size too large. Maximum: " + (MAX_FILE_SIZE / 1024 / 1024) + "MB";
        }

        String contentType = file.getContentType();
        if (contentType == null) {
            return "Unknown file type";
        }

        if (!isAllowedFileType(contentType)) {
            return "File type not allowed: " + contentType;
        }

        return null; 
    }

    /**
     * Check if file type is allowed
     */
    private boolean isAllowedFileType(String contentType) {
        return ALLOWED_IMAGE_TYPES.contains(contentType) ||
               ALLOWED_VIDEO_TYPES.contains(contentType) ||
               ALLOWED_AUDIO_TYPES.contains(contentType) ||
               ALLOWED_DOCUMENT_TYPES.contains(contentType);
    }

    /**
     * Extract user ID from Authentication object
     */
    private UUID extractUserIdFromAuthentication(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            log.warn("Authentication is null or not authenticated");
            return null;
        }

        try {
            Object principal = authentication.getPrincipal();
            
            if (principal instanceof String) {
                String userId = (String) principal;
                log.debug("Extracted user ID from authentication: {}", userId);
                return UUID.fromString(userId);
            } else {
                log.warn("Principal is not a string: {}", principal.getClass().getSimpleName());
                return null;
            }
        } catch (Exception e) {
            log.error("Error extracting user ID from authentication: {}", e.getMessage());
            return null;
        }
    }
}
