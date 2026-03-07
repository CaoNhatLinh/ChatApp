// src/components/chat/MessageFileAttachment.tsx

import React, { useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File as FileIcon
} from 'lucide-react';

interface FileAttachment {
  url: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  resourceType: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
}

interface MessageFileAttachmentProps {
  attachments: FileAttachment[];
}

export const MessageFileAttachment: React.FC<MessageFileAttachmentProps> = ({
  attachments
}) => {
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Get file icon based on type
  const getFileIcon = (contentType: string, resourceType: string) => {
    if (resourceType === 'image') return <ImageIcon className="w-5 h-5" />;
    if (resourceType === 'video') return <Video className="w-5 h-5" />;
    if (contentType.startsWith('audio/')) return <Music className="w-5 h-5" />;
    if (contentType === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <FileIcon className="w-5 h-5" />;
  };

  // Download file
  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error instanceof Error ? error.message : error);
    }
  };

  // Toggle image expansion
  const toggleImageExpansion = (url: string) => {
    const newExpanded = new Set(expandedImages);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedImages(newExpanded);
  };

  // Render image attachment
  const renderImageAttachment = (attachment: FileAttachment, index: number) => {
    const isExpanded = expandedImages.has(attachment.url);
    const displayUrl = isExpanded
      ? attachment.url
      : attachment.mediumUrl || attachment.thumbnailUrl || attachment.url;

    return (
      <div key={index} className="relative group">
        <div className={`relative overflow-hidden rounded-lg ${isExpanded ? 'max-w-none' : 'max-w-sm'}`}>
          <img
            src={displayUrl}
            alt={attachment.fileName}
            className={`cursor-pointer transition-all ${isExpanded ? 'max-h-96 w-auto' : 'max-h-60 w-full object-cover'
              }`}
            onClick={() => toggleImageExpansion(attachment.url)}
            loading="lazy"
          />

          {/* Image overlay controls */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex space-x-2">
              <button
                onClick={() => toggleImageExpansion(attachment.url)}
                className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                title={isExpanded ? "Thu nhỏ" : "Xem đầy đủ"}
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => downloadFile(attachment.url, attachment.fileName)}
                className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                title="Tải xuống"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Image info */}
        <div className="mt-2 text-xs text-gray-500">
          <span>{attachment.fileName}</span>
          <span className="mx-2">•</span>
          <span>{formatFileSize(attachment.fileSize)}</span>
        </div>
      </div>
    );
  };

  // Render video attachment
  const renderVideoAttachment = (attachment: FileAttachment, index: number) => {
    return (
      <div key={index} className="relative max-w-sm">
        <video
          src={attachment.url}
          controls
          className="w-full rounded-lg"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>

        {/* Video info */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div>
            <span>{attachment.fileName}</span>
            <span className="mx-2">•</span>
            <span>{formatFileSize(attachment.fileSize)}</span>
          </div>
          <button
            onClick={() => downloadFile(attachment.url, attachment.fileName)}
            className="text-blue-500 hover:text-blue-700 flex items-center space-x-1"
            title="Tải xuống"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  // Render audio attachment
  const renderAudioAttachment = (attachment: FileAttachment, index: number) => {
    return (
      <div key={index} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-sm">
        <div className="flex items-center space-x-3 mb-3">
          <div className="bg-blue-500 text-white p-2 rounded-full">
            <Music className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {attachment.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(attachment.fileSize)}
            </p>
          </div>
        </div>

        <audio
          src={attachment.url}
          controls
          className="w-full"
          preload="metadata"
        >
          Your browser does not support the audio element.
        </audio>

        <button
          onClick={() => downloadFile(attachment.url, attachment.fileName)}
          className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center space-x-1"
          title="Tải xuống"
        >
          <Download className="w-3 h-3" />
          <span>Tải xuống</span>
        </button>
      </div>
    );
  };

  // Render document/file attachment
  const renderFileAttachment = (attachment: FileAttachment, index: number) => {
    return (
      <div key={index} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-gray-500 text-white p-2 rounded-full">
            {getFileIcon(attachment.contentType, attachment.resourceType)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {attachment.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(attachment.fileSize)}
            </p>
          </div>
          <button
            onClick={() => downloadFile(attachment.url, attachment.fileName)}
            className="text-blue-500 hover:text-blue-700 p-1"
            title="Tải xuống"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-3">
      {attachments.map((attachment, index) => {
        // Render based on resource type
        if (attachment.resourceType === 'image') {
          return renderImageAttachment(attachment, index);
        } else if (attachment.resourceType === 'video') {
          return renderVideoAttachment(attachment, index);
        } else if (attachment.contentType.startsWith('audio/')) {
          return renderAudioAttachment(attachment, index);
        } else {
          return renderFileAttachment(attachment, index);
        }
      })}
    </div>
  );
};
