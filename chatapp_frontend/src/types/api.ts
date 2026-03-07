// src/types/api.ts

import type { UserDTO } from "./user";

// Generic API Response wrapper
export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

// Error response interface
export interface ApiError {
  status: number;
  message: string;
  error?: string;
  timestamp?: string;
}

// Pagination interface
export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Common query parameters
export interface BaseQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
}

// Authentication related
export interface AuthResponse {
  token: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserDTO;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  displayName?: string;
}
