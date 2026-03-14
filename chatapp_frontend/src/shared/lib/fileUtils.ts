// src/utils/fileUtils.ts
// Shared file utilities: format size, validate, type detection

/** Format bytes to human-readable file size */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Get file category from MIME type */
export function getFileCategory(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

/** Validate a file against size and type constraints */
export function validateFile(
    file: File,
    maxFileSizeMB: number,
    acceptedFileTypes: string[]
): string | null {
    // Check file size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
        return `File too large. Maximum: ${maxFileSizeMB}MB`;
    }

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isValidType = acceptedFileTypes.some(type => {
        if (type.includes('*')) {
            return file.type.startsWith(type.replace('*', ''));
        }
        if (type === 'application/msword' && fileExtension === 'doc') return true;
        if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && fileExtension === 'docx') return true;
        if (type === 'text/plain' && fileExtension === 'txt') return true;
        return file.type === type;
    });

    if (!isValidType) {
        return 'Unsupported file format';
    }

    return null;
}
