import axios from "axios";
import { logger } from "../common/lib/logger";

// 🌐 Base API URL - Change to your backend URL
const API_BASE_URL = String(import.meta.env.VITE_API_URL || "http://localhost:8084/api");

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// 📤 Request interceptor - Add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log in development mode
    if (import.meta.env.DEV) {
      logger.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
        token: token ? '✅ Present' : '❌ Missing',
        data: String(config.data),
      });
    }

    return config;
  },
  (error) => {
    const wrappedError = error instanceof Error ? error : new Error(String(error));
    logger.error("[API] Request error:", wrappedError.message);
    return Promise.reject(wrappedError);
  }
);

// 📥 Response interceptor - Handle errors and token refresh
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (import.meta.env.DEV) {
      logger.debug(`[API] ✅ Response ${response.status}:`, JSON.stringify(response.data));
    }
    return response;
  },
  async (error) => {
    if (!axios.isAxiosError(error)) {
      const wrappedError = error instanceof Error ? error : new Error(String(error));
      logger.error("[API] Non-Axios Error:", wrappedError.message);
      return Promise.reject(wrappedError);
    }

    const axiosError = error;
    const originalRequest = axiosError.config as { _retry?: boolean; url?: string } | undefined;

    // Log errors in development
    if (import.meta.env.DEV) {
      logger.error(`[API] ❌ Error ${axiosError.response?.status}:`, {
        url: originalRequest?.url,
        error: JSON.stringify(axiosError.response?.data),
      });
    }

    // Handle 401 Unauthorized - Token expired or invalid
    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear token and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      return Promise.reject(axiosError);
    }

    // Handle 403 Forbidden
    if (axiosError.response?.status === 403) {
      logger.warn("[API] Access forbidden");
    }

    // Handle 500 Server Error
    if (axiosError.response?.status && axiosError.response.status >= 500) {
      logger.error("[API] Server error");
    }

    return Promise.reject(axiosError);
  }
);

export default api;
