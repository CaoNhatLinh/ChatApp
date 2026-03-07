// src/hooks/useFileUpload.ts

import { useState, useCallback } from 'react';
import { fileUploadService, type UploadedFile } from '@/services/fileUploadService';

export interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<UploadedFile>;
  uploadMultipleFiles: (files: File[]) => Promise<{
    uploadedFiles: UploadedFile[];
    errors: string[];
  }>;
  deleteFile: (publicId: string, resourceType?: string) => Promise<boolean>;
  isUploading: boolean;
  uploadProgress: Record<string, number>;
  error: string | null;
  clearError: () => void;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile> => {
    setIsUploading(true);
    setError(null);

    const fileId = Math.random().toString(36).substring(2, 11);
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

    try {
      // Simulate progress (since we don't have real progress from fetch)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: Math.min((prev[fileId] || 0) + 10, 90)
        }));
      }, 100);

      const result = await fileUploadService.uploadFile(file);

      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 2000);
    }
  }, []);

  const uploadMultipleFiles = useCallback(async (files: File[]): Promise<{
    uploadedFiles: UploadedFile[];
    errors: string[];
  }> => {
    setIsUploading(true);
    setError(null);

    try {
      const result = await fileUploadService.uploadMultipleFiles(files);

      if (result.errors.length > 0) {
        setError(`Some files failed to upload: ${result.errors.join(', ')}`);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const deleteFile = useCallback(async (publicId: string, resourceType?: string): Promise<boolean> => {
    setError(null);

    try {
      return await fileUploadService.deleteFile(publicId, resourceType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    isUploading,
    uploadProgress,
    error,
    clearError
  };
};
