// src/services/cloudinaryService.ts
// Cloudinary unsigned upload service for chat file/media sharing

import { logger } from '@/common/lib/logger';

const CLOUD_NAME = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '');
const UPLOAD_PRESET = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '');
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

// Maximum file sizes (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25MB

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_DOC_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
];

export interface CloudinaryUploadResult {
    url: string;
    secureUrl: string;
    publicId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
    format: string;
    resourceType: 'image' | 'video' | 'raw';
}

export type FileCategory = 'image' | 'video' | 'document';

/**
 * Detect file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
    return 'document';
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
    const category = getFileCategory(file.type);

    // Check allowed types
    const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOC_TYPES];
    if (!allAllowed.includes(file.type)) {
        return { valid: false, error: `File type "${file.type}" is not supported` };
    }

    // Check file size based on category
    const maxSize = category === 'image' ? MAX_IMAGE_SIZE
        : category === 'video' ? MAX_VIDEO_SIZE
            : MAX_FILE_SIZE;

    if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        return { valid: false, error: `File size exceeds ${maxMB}MB limit` };
    }

    return { valid: true };
}

/**
 * Upload a file to Cloudinary using unsigned upload
 */
export async function uploadToCloudinary(
    file: File,
    onProgress?: (percent: number) => void
): Promise<CloudinaryUploadResult> {
    // Validate before upload
    const validation = validateFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Cloudinary configuration is missing. Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'chatapp'); // Organize uploads in a folder

    logger.debug('[Cloudinary] Uploading file:', file.name, `(${Math.round(file.size / 1024)}KB)`);

    return new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', UPLOAD_URL);

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText) as {
                    secure_url: string;
                    url: string;
                    public_id: string;
                    original_filename: string;
                    bytes: number;
                    format: string;
                    resource_type: string;
                    width?: number;
                    height?: number;
                };

                const result: CloudinaryUploadResult = {
                    url: response.url,
                    secureUrl: response.secure_url,
                    publicId: response.public_id,
                    fileName: file.name,
                    fileSize: response.bytes,
                    mimeType: file.type,
                    width: response.width,
                    height: response.height,
                    format: response.format,
                    resourceType: response.resource_type as 'image' | 'video' | 'raw',
                };

                logger.debug('[Cloudinary] Upload successful:', result.secureUrl);
                resolve(result);
            } else {
                const errorText = xhr.responseText || `Upload failed with status ${xhr.status}`;
                logger.error('[Cloudinary] Upload failed:', errorText);
                reject(new Error(errorText));
            }
        });

        xhr.addEventListener('error', () => {
            logger.error('[Cloudinary] Network error during upload');
            reject(new Error('Network error during file upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload was cancelled'));
        });

        xhr.send(formData);
    });
}

/**
 * Generate Cloudinary thumbnail URL for images
 */
export function getThumbnailUrl(url: string, width = 200, height = 200): string {
    if (!url.includes('cloudinary.com')) return url;
    // Insert transformation before /upload/
    return url.replace('/upload/', `/upload/c_fill,w_${width},h_${height},q_auto,f_auto/`);
}

/**
 * Generate optimized URL for display
 */
export function getOptimizedUrl(url: string, maxWidth = 800): string {
    if (!url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/c_limit,w_${maxWidth},q_auto,f_auto/`);
}
