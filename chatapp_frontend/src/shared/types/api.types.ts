// src/shared/types/api.types.ts
// Generic API response types for the entire application

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface ApiError {
  status: number;
  message: string;
  error?: string;
  timestamp?: string;
}

export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  content: T[];
  hasNext: boolean;
  number: number;
  size: number;
}

export interface SpringPage<T> {
  content: T[];
  hasNext?: boolean;
  last?: boolean;
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface BaseQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
}
