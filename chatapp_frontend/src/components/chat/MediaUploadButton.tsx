// src/components/chat/MediaUploadButton.tsx
// Cloudinary upload button with drag & drop, preview, and progress tracking

import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, X, Upload, Loader2, Image as ImageIcon, FileText, Video } from 'lucide-react';
import {
    uploadToCloudinary,
    validateFile,
    getFileCategory,
    getThumbnailUrl,
    type CloudinaryUploadResult,
    type FileCategory,
} from '@/services/cloudinaryService';
import { logger } from '@/common/lib/logger';

export interface UploadedMedia {
    result: CloudinaryUploadResult;
    category: FileCategory;
    previewUrl: string;
}

interface MediaUploadButtonProps {
    onUploadComplete: (media: UploadedMedia) => void;
    onUploadError?: (error: string) => void;
    disabled?: boolean;
    className?: string;
}

interface PendingFile {
    file: File;
    previewUrl: string;
    category: FileCategory;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
    result?: CloudinaryUploadResult;
}

const CategoryIcon: React.FC<{ category: FileCategory; className?: string }> = ({ category, className }) => {
    switch (category) {
        case 'image': return <ImageIcon className={className} />;
        case 'video': return <Video className={className} />;
        default: return <FileText className={className} />;
    }
};

export const MediaUploadButton: React.FC<MediaUploadButtonProps> = ({
    onUploadComplete,
    onUploadError,
    disabled = false,
    className = '',
}) => {
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file selection from input
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newPending: PendingFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const validation = validateFile(file);
            const category = getFileCategory(file.type);

            // Create preview URL for images
            const previewUrl = category === 'image' ? URL.createObjectURL(file) : '';

            newPending.push({
                file,
                previewUrl,
                category,
                progress: 0,
                status: validation.valid ? 'pending' : 'error',
                error: validation.error,
            });
        }

        setPendingFiles(prev => [...prev, ...newPending]);
        setIsOpen(true);

        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // Upload a single file
    const uploadFile = useCallback(async (index: number) => {
        const pending = pendingFiles[index];
        if (!pending || pending.status !== 'pending') return;

        // Update status to uploading
        setPendingFiles(prev => prev.map((f, i) =>
            i === index ? { ...f, status: 'uploading' as const } : f
        ));

        try {
            const result = await uploadToCloudinary(pending.file, (percent) => {
                setPendingFiles(prev => prev.map((f, i) =>
                    i === index ? { ...f, progress: percent } : f
                ));
            });

            const media: UploadedMedia = {
                result,
                category: pending.category,
                previewUrl: pending.category === 'image' ? getThumbnailUrl(result.secureUrl) : '',
            };

            setPendingFiles(prev => prev.map((f, i) =>
                i === index ? { ...f, status: 'done' as const, progress: 100, result } : f
            ));

            onUploadComplete(media);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Upload failed';
            logger.error('[MediaUpload] Upload failed:', errorMsg);

            setPendingFiles(prev => prev.map((f, i) =>
                i === index ? { ...f, status: 'error' as const, error: errorMsg } : f
            ));

            onUploadError?.(errorMsg);
        }
    }, [pendingFiles, onUploadComplete, onUploadError]);

    // Upload all pending files
    const uploadAll = useCallback(async () => {
        const pendingIndices = pendingFiles
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => f.status === 'pending')
            .map(({ i }) => i);

        for (const index of pendingIndices) {
            await uploadFile(index);
        }
    }, [pendingFiles, uploadFile]);

    // Remove a file from the list
    const removeFile = useCallback((index: number) => {
        setPendingFiles(prev => {
            const file = prev[index];
            // Revoke preview URL to free memory
            if (file.previewUrl) {
                URL.revokeObjectURL(file.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    }, []);

    // Clear all files
    const clearAll = useCallback(() => {
        pendingFiles.forEach(f => {
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        setPendingFiles([]);
        setIsOpen(false);
    }, [pendingFiles]);

    const hasPending = pendingFiles.some(f => f.status === 'pending');
    const hasUploading = pendingFiles.some(f => f.status === 'uploading');

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    return (
        <div className={`relative ${className}`}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || hasUploading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                title="Attach file"
            >
                <Paperclip className="w-5 h-5" />
            </button>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Upload panel */}
            {isOpen && pendingFiles.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {pendingFiles.length} file(s)
                        </span>
                        <button
                            onClick={clearAll}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* File list */}
                    <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                        {pendingFiles.map((pf, index) => (
                            <div
                                key={`${pf.file.name}-${index}`}
                                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                            >
                                {/* Preview / Icon */}
                                {pf.category === 'image' && pf.previewUrl ? (
                                    <img
                                        src={pf.previewUrl}
                                        alt={pf.file.name}
                                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <CategoryIcon category={pf.category} className="w-5 h-5 text-gray-500" />
                                    </div>
                                )}

                                {/* File info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {pf.file.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatSize(pf.file.size)}
                                        {pf.status === 'uploading' && ` • ${pf.progress}%`}
                                        {pf.status === 'done' && ' • Done'}
                                        {pf.status === 'error' && ` • ${pf.error}`}
                                    </p>

                                    {/* Progress bar */}
                                    {pf.status === 'uploading' && (
                                        <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                                            <div
                                                className="bg-blue-500 h-1 rounded-full transition-all duration-200"
                                                style={{ width: `${pf.progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Status / Remove */}
                                {pf.status === 'uploading' ? (
                                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                                ) : pf.status === 'done' ? (
                                    <span className="text-xs text-green-500 flex-shrink-0">OK</span>
                                ) : (
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    {hasPending && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => void uploadAll()}
                                disabled={hasUploading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                Upload & Send
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MediaUploadButton;
