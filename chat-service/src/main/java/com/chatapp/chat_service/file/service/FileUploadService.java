package com.chatapp.chat_service.file.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Transformation;
import com.cloudinary.utils.ObjectUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class FileUploadService {

    private final Cloudinary cloudinary;

    public FileUploadService(
            @Value("${cloudinary.cloud-name}") String cloudName,
            @Value("${cloudinary.api-key}") String apiKey,
            @Value("${cloudinary.api-secret}") String apiSecret) {
        
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    /**
     * Upload file to Cloudinary and return file info
     */
    public FileUploadResult uploadFile(MultipartFile file, UUID senderId) throws IOException {
        try {
            if (file.isEmpty()) {
                throw new IllegalArgumentException("File is empty");
            }

            String resourceType = determineResourceType(file.getContentType());
            
            String originalFilename = file.getOriginalFilename();
            String fileExtension = originalFilename != null && originalFilename.contains(".") 
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
            
            String publicId = "chat_files/" + senderId + "/" + UUID.randomUUID().toString() + fileExtension;

            Map<String, Object> uploadOptions = ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", resourceType,
                "folder", "chat_app",
                "use_filename", true,
                "unique_filename", false,
                "overwrite", false
            );

            if ("image".equals(resourceType)) {
                Transformation transformation = new Transformation()
                    .quality("auto")
                    .fetchFormat("auto");
                uploadOptions.put("transformation", transformation);
            }

            Map<String, Object> uploadResult = cloudinary.uploader().upload(file.getBytes(), uploadOptions);

            String secureUrl = (String) uploadResult.get("secure_url");
            String publicIdResult = (String) uploadResult.get("public_id");
            Integer bytes = (Integer) uploadResult.get("bytes");
            String format = (String) uploadResult.get("format");
            String resourceTypeResult = (String) uploadResult.get("resource_type");

            log.info("File uploaded successfully: {} -> {}", originalFilename, secureUrl);

            return FileUploadResult.builder()
                    .url(secureUrl)
                    .publicId(publicIdResult)
                    .fileName(originalFilename)
                    .fileSize(bytes != null ? bytes.longValue() : file.getSize())
                    .contentType(file.getContentType())
                    .resourceType(resourceTypeResult)
                    .format(format)
                    .build();

        } catch (Exception e) {
            log.error("Error uploading file to Cloudinary: {}", e.getMessage(), e);
            throw new IOException("Failed to upload file: " + e.getMessage(), e);
        }
    }

    /**
     * Delete file from Cloudinary
     */
    public boolean deleteFile(String publicId, String resourceType) {
        try {
            Map<String, Object> deleteOptions = ObjectUtils.asMap(
                "resource_type", resourceType != null ? resourceType : "auto"
            );

            Map<String, Object> result = cloudinary.uploader().destroy(publicId, deleteOptions);
            String resultStatus = (String) result.get("result");
            
            boolean success = "ok".equals(resultStatus);
            log.info("File deletion result for {}: {}", publicId, resultStatus);
            
            return success;
        } catch (Exception e) {
            log.error("Error deleting file from Cloudinary: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Determine Cloudinary resource type based on MIME type
     */
    private String determineResourceType(String contentType) {
        if (contentType == null) {
            return "auto";
        }

        if (contentType.startsWith("image/")) {
            return "image";
        } else if (contentType.startsWith("video/")) {
            return "video";
        } else if (contentType.startsWith("audio/")) {
            return "video"; 
        } else {
            return "raw"; 
        }
    }

    /**
     * Generate optimized URL for different use cases
     */
    public String generateOptimizedUrl(String publicId, String resourceType, OptimizationOptions options) {
        try {
            if ("image".equals(resourceType) && options != null) {
                Transformation transformation = new Transformation();
                
                if (options.getWidth() != null || options.getHeight() != null) {
                    if (options.getWidth() != null) transformation.width(options.getWidth());
                    if (options.getHeight() != null) transformation.height(options.getHeight());
                    transformation.crop("fill");
                }
                
                if (options.getQuality() != null) {
                    transformation.quality(options.getQuality());
                }
                
                transformation.fetchFormat("auto");
                
                return cloudinary.url()
                        .resourceType(resourceType)
                        .transformation(transformation)
                        .generate(publicId);
            } else {
                return cloudinary.url().resourceType(resourceType).generate(publicId);
            }
        } catch (Exception e) {
            log.error("Error generating optimized URL: {}", e.getMessage());
            return null;
        }
    }

    public static class FileUploadResult {
        private String url;
        private String publicId;
        private String fileName;
        private Long fileSize;
        private String contentType;
        private String resourceType;
        private String format;

        public static FileUploadResultBuilder builder() {
            return new FileUploadResultBuilder();
        }

        public static class FileUploadResultBuilder {
            private String url;
            private String publicId;
            private String fileName;
            private Long fileSize;
            private String contentType;
            private String resourceType;
            private String format;

            public FileUploadResultBuilder url(String url) {
                this.url = url;
                return this;
            }

            public FileUploadResultBuilder publicId(String publicId) {
                this.publicId = publicId;
                return this;
            }

            public FileUploadResultBuilder fileName(String fileName) {
                this.fileName = fileName;
                return this;
            }

            public FileUploadResultBuilder fileSize(Long fileSize) {
                this.fileSize = fileSize;
                return this;
            }

            public FileUploadResultBuilder contentType(String contentType) {
                this.contentType = contentType;
                return this;
            }

            public FileUploadResultBuilder resourceType(String resourceType) {
                this.resourceType = resourceType;
                return this;
            }

            public FileUploadResultBuilder format(String format) {
                this.format = format;
                return this;
            }

            public FileUploadResult build() {
                FileUploadResult result = new FileUploadResult();
                result.url = this.url;
                result.publicId = this.publicId;
                result.fileName = this.fileName;
                result.fileSize = this.fileSize;
                result.contentType = this.contentType;
                result.resourceType = this.resourceType;
                result.format = this.format;
                return result;
            }
        }

        public String getUrl() { return url; }
        public String getPublicId() { return publicId; }
        public String getFileName() { return fileName; }
        public Long getFileSize() { return fileSize; }
        public String getContentType() { return contentType; }
        public String getResourceType() { return resourceType; }
        public String getFormat() { return format; }
    }

    public static class OptimizationOptions {
        private Integer width;
        private Integer height;
        private String quality;

        public Integer getWidth() { return width; }
        public void setWidth(Integer width) { this.width = width; }
        
        public Integer getHeight() { return height; }
        public void setHeight(Integer height) { this.height = height; }
        
        public String getQuality() { return quality; }
        public void setQuality(String quality) { this.quality = quality; }

        public static OptimizationOptions thumbnail() {
            OptimizationOptions options = new OptimizationOptions();
            options.setWidth(150);
            options.setHeight(150);
            options.setQuality("auto");
            return options;
        }

        public static OptimizationOptions medium() {
            OptimizationOptions options = new OptimizationOptions();
            options.setWidth(800);
            options.setQuality("auto");
            return options;
        }
    }
}
