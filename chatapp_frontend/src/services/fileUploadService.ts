// src/services/fileUploadService.ts

import { getAuthToken, isTokenExpired } from '@/utils/auth';

const API_BASE_URL = 'http://localhost:8084/api/files';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  publicId: string;
  resourceType?: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
}

export interface FileUploadResponse {
  success: boolean;
  file: {
    url: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    resourceType: string;
    publicId: string;
    format: string;
    thumbnailUrl?: string;
    mediumUrl?: string;
  };
  error?: string;
}

export interface MultipleFileUploadResponse {
  success: boolean;
  uploadedFiles: Array<{
    url: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    resourceType: string;
    publicId: string;
    format: string;
    thumbnailUrl?: string;
    mediumUrl?: string;
  }>;
  uploadedCount: number;
  totalFiles: number;
  errors?: string[];
}

class FileUploadService {
  /**
   * Upload single file
   */
  async uploadFile(file: File): Promise<UploadedFile> {
    // Validate file object

    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file object provided');
    }

    if (!file.name || file.size === undefined || file.size === 0) {
      throw new Error('File is empty or invalid');
    }

    const token = getAuthToken();
    if (!token) {
      throw new Error('Token xác thực không tồn tại. Vui lòng đăng nhập lại.');
    }

    // Debug token info


    // Check if token is expired
    if (isTokenExpired(token)) {
      console.error('🔐 [FileUpload] Token is expired');
      throw new Error('Token đã hết hạn. Vui lòng đăng nhập lại.');
    }



    const formData = new FormData();

    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const result = await response.json() as FileUploadResponse;

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }
    return {
      id: Math.random().toString(36).substring(2, 11), // Generate temp ID
      name: result.file.fileName,
      type: result.file.contentType,
      size: result.file.fileSize,
      url: result.file.url,
      publicId: result.file.publicId,
      resourceType: result.file.resourceType,
      thumbnailUrl: result.file.thumbnailUrl,
      mediumUrl: result.file.mediumUrl
    };
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(files: File[]): Promise<{
    uploadedFiles: UploadedFile[];
    errors: string[];
  }> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token xác thực không tồn tại. Vui lòng đăng nhập lại.');
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/upload/multiple`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const result = await response.json() as MultipleFileUploadResponse;

    const uploadedFiles: UploadedFile[] = result.uploadedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 11), // Generate temp ID
      name: file.fileName,
      type: file.contentType,
      size: file.fileSize,
      url: file.url,
      publicId: file.publicId,
      resourceType: file.resourceType,
      thumbnailUrl: file.thumbnailUrl,
      mediumUrl: file.mediumUrl
    }));

    return {
      uploadedFiles,
      errors: result.errors || []
    };
  }

  /**
   * Delete file
   */
  async deleteFile(publicId: string, resourceType?: string): Promise<boolean> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token xác thực không tồn tại. Vui lòng đăng nhập lại.');
    }

    const url = new URL(`${API_BASE_URL}/delete/${publicId}`);
    if (resourceType) {
      url.searchParams.append('resourceType', resourceType);
    }

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const result = await response.json() as { success: boolean };
    return result.success;
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    if (response.status === 401) {
      throw new Error('Token xác thực không hợp lệ. Vui lòng đăng nhập lại.');
    }

    let errorMessage = 'Upload failed';
    try {
      const errorData = await response.json() as { error?: string; message?: string };
      errorMessage = errorData.error ?? errorData.message ?? errorMessage;
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      errorMessage = response.statusText || `HTTP ${response.status}`;
    }

    throw new Error(errorMessage);
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();
export default fileUploadService;
