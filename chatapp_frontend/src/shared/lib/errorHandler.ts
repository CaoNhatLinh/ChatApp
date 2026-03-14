// src/utils/errorHandler.ts

import axios from 'axios';

export interface AppError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Convert unknown error to structured AppError.
 * Use this in all catch blocks instead of casting to Error or any.
 */
export function toAppError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return {
      message: data?.message ?? error.message,
      status: error.response?.status,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'An unknown error occurred' };
}

/**
 * Extract error message from unknown error.
 * Shorthand for toAppError(e).message
 */
export function getErrorMessage(error: unknown): string {
  return toAppError(error).message;
}

/**
 * Helper to display a success toast.
 * Replace with your actual toast implementation (e.g., react-hot-toast).
 */
export function showSuccessToast(message: string): void {
  console.warn('[SUCCESS]', message);
}

/**
 * Error handler helpers for conversation actions.
 */
export const conversationErrors = {
  leave: (error: unknown): void => {
    console.error('Failed to leave conversation:', getErrorMessage(error));
  },
  delete: (error: unknown): void => {
    console.error('Failed to delete conversation:', getErrorMessage(error));
  },
};

/**
 * Error handler helpers for friend request actions.
 */
export const friendRequestErrors = {
  send: (error: unknown): void => {
    console.error('Failed to send friend request:', getErrorMessage(error));
  },
  accept: (error: unknown): void => {
    console.error('Failed to accept friend request:', getErrorMessage(error));
  },
  reject: (error: unknown): void => {
    console.error('Failed to reject friend request:', getErrorMessage(error));
  },
};
