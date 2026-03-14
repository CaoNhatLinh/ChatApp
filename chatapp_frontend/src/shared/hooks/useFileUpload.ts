import { useState, useCallback } from 'react';

export interface UploadedFile {
  url: string;
  publicId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface UseFileUploadOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export interface UseFileUploadReturn {
  uploading: boolean;
  progress: number;
  error: string | null;
  uploadFile: (file: File) => Promise<UploadedFile | null>;
  reset: () => void;
}

const DEFAULT_MAX_SIZE_MB = 10;
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf'];

/**
 * Hook for managing file uploads with loading, progress and error state.
 * TODO: integrate with @/services/fileUploadService when available.
 */
export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const {
    maxSizeMB = DEFAULT_MAX_SIZE_MB,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
  } = options;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    setError(null);
    setProgress(0);

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError('File size exceeds ' + maxSizeMB + 'MB limit');
      return null;
    }

    if (allowedTypes.length > 0 && allowedTypes.indexOf(file.type) === -1) {
      setError('File type is not allowed: ' + file.type);
      return null;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      setProgress(30);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      setProgress(90);

      if (response.ok === false) {
        throw new Error('Upload failed: ' + response.statusText);
      }

      const data = (await response.json()) as UploadedFile;
      setProgress(100);

      return {
        url: data.url,
        publicId: data.publicId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return null;
    } finally {
      setUploading(false);
    }
  }, [maxSizeMB, allowedTypes]);

  return { uploading, progress, error, uploadFile, reset };
}
