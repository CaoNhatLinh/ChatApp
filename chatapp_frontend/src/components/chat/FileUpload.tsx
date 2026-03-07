// src/components/chat/FileUpload.tsx
// Refactored: extracted FilePreviewItem and fileUtils

import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileUpload } from '@/hooks/useFileUpload';
import type { UploadedFile as ServiceUploadedFile } from '@/services/fileUploadService';
import { Upload, Loader2, AlertCircle, X } from 'lucide-react';
import { validateFile } from '@/utils/fileUtils';
import { FilePreviewItem } from './FilePreviewItem';

interface FileUploadProps {
  onFileSelect: (files: FileWithPreview[]) => void;
  onFileUpload: (uploadedFiles: ServiceUploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string[];
  disabled?: boolean;
}

export interface FileWithPreview extends File {
  preview?: string;
  id: string;
  uploadProgress?: number;
  uploadStatus?: 'uploading' | 'success' | 'error';
  uploadError?: string;
  uploadedUrl?: string;
}

const DEFAULT_ACCEPTED_TYPES = [
  'image/*', 'video/*', 'audio/*',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileUpload,
  maxFiles = 5,
  maxFileSize = 10,
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, uploadMultipleFiles, error, clearError } = useFileUpload();

  // Handle file selection with validation
  const handleFileSelect = (files: File[]) => {
    if (disabled) return;

    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      const validationError = validateFile(file, maxFileSize, acceptedFileTypes);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      const fileWithPreview: FileWithPreview = Object.assign(file, {
        id: Math.random().toString(36).substring(2, 11),
        uploadStatus: undefined,
      });

      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }

      validFiles.push(fileWithPreview);
    });

    if (selectedFiles.length + validFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return;
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    const newFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(newFiles);
    onFileSelect(newFiles);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      handleFileSelect(files);
    }
    event.target.value = '';
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileSelect,
    accept: acceptedFileTypes.reduce<Record<string, string[]>>((acc, type) => {
      acc[type] = [];
      return acc;
    }, {}),
    maxFiles,
    disabled,
    noClick: false,
    noKeyboard: true,
  });

  const removeFile = (fileId: string) => {
    const newFiles = selectedFiles.filter(f => f.id !== fileId);
    setSelectedFiles(newFiles);
    onFileSelect(newFiles);
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    clearError();

    try {
      const filesToUpload = selectedFiles.map(f =>
        new File([f], f.name, { type: f.type, lastModified: f.lastModified })
      );

      if (filesToUpload.length === 1) {
        setSelectedFiles(prev =>
          prev.map(f => f.id === selectedFiles[0].id ? { ...f, uploadStatus: 'uploading', uploadProgress: 0 } : f)
        );

        const uploadedFile = await uploadFile(filesToUpload[0]);

        setSelectedFiles(prev =>
          prev.map(f => f.id === selectedFiles[0].id
            ? { ...f, uploadStatus: 'success', uploadProgress: 100, uploadedUrl: uploadedFile.url }
            : f
          )
        );

        onFileUpload([uploadedFile]);
      } else {
        const { uploadedFiles, errors: uploadErrors } = await uploadMultipleFiles(filesToUpload);
        if (uploadErrors.length > 0) {
          console.warn('Some files failed to upload:', uploadErrors);
        }
        onFileUpload(uploadedFiles);
      }

      setSelectedFiles([]);
    } catch (err) {
      console.error('Upload error:', err instanceof Error ? err.message : err);
      setSelectedFiles(prev =>
        prev.map(f => ({
          ...f,
          uploadStatus: 'error',
          uploadError: err instanceof Error ? err.message : 'Upload failed',
        }))
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFileTypes.join(',')}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} style={{ display: 'none' }} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600 dark:text-blue-400">Drop files here...</p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-300 mb-2">Drag & drop files or click to select</p>
            <p className="text-sm text-gray-500 mt-2">
              Images, Video, Audio, PDF, Word ({maxFileSize}MB max)
            </p>
          </div>
        )}
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">
            Selected ({selectedFiles.length}/{maxFiles})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedFiles.map((file) => (
              <FilePreviewItem key={file.id} file={file} onRemove={removeFile} disabled={uploading} />
            ))}
          </div>
          <button
            onClick={() => void uploadFiles()}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
