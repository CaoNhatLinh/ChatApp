// src/components/chat/FilePreviewItem.tsx
// Individual file preview row with progress, status icons, and remove button

import React from 'react';
import {
    Image,
    Video,
    Music,
    File as FileIcon,
    X,
    Loader2,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';
import { formatFileSize, getFileCategory } from '@/utils/fileUtils';

interface FilePreviewItemProps {
    file: {
        id: string;
        name: string;
        size: number;
        type: string;
        preview?: string;
        uploadProgress?: number;
        uploadStatus?: 'uploading' | 'success' | 'error';
    };
    onRemove: (fileId: string) => void;
    disabled?: boolean;
}

function getFileIcon(mimeType: string): React.ReactNode {
    const category = getFileCategory(mimeType);
    switch (category) {
        case 'image': return <Image className="w-5 h-5" />;
        case 'video': return <Video className="w-5 h-5" />;
        case 'audio': return <Music className="w-5 h-5" />;
        default: return <FileIcon className="w-5 h-5" />;
    }
}

export const FilePreviewItem: React.FC<FilePreviewItemProps> = ({ file, onRemove, disabled }) => {
    return (
        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {/* File Icon/Preview */}
            <div className="flex-shrink-0">
                {file.preview ? (
                    <img src={file.preview} alt={file.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                        {getFileIcon(file.type)}
                    </div>
                )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>

                {/* Upload Progress Bar */}
                {file.uploadStatus === 'uploading' && (
                    <div className="mt-1">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${file.uploadProgress ?? 0}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Status Icons */}
            <div className="flex-shrink-0">
                {file.uploadStatus === 'uploading' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                {file.uploadStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {file.uploadStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                {!file.uploadStatus && (
                    <button onClick={() => onRemove(file.id)} className="text-gray-400 hover:text-red-600" disabled={disabled}>
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};
