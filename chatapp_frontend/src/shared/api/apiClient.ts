import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../lib/logger';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:8084/api');

class ApiClient {
    private instance: AxiosInstance;

    constructor() {
        this.instance = axios.create({
            baseURL: API_BASE_URL,
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        this.setupInterceptors();
    }

    private setupInterceptors() {
        // Request Interceptor
        this.instance.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }

                if (import.meta.env.DEV) {
                    logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
                }
                return config;
            },
            (error) => {
                const wrappedError = error instanceof Error ? error : new Error(String(error));
                logger.error('API Request Error', wrappedError.message);
                return Promise.reject(wrappedError);
            }
        );

        // Response Interceptor
        this.instance.interceptors.response.use(
            (response) => {
                if (import.meta.env.DEV) {
                    logger.debug(`API Response ${response.status}: ${response.config.url}`);
                }
                return response;
            },
            async (error) => {
                if (!axios.isAxiosError(error)) {
                    const wrappedError = error instanceof Error ? error : new Error(String(error));
                    return Promise.reject(wrappedError);
                }

                const axiosError = error;
                const status = axiosError.response?.status;

                if (status === 401) {
                    logger.warn('Unauthorized access - potential token expiry');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    if (typeof window !== 'undefined') {
                        window.location.href = '/login';
                    }
                }

                if (import.meta.env.DEV) {
                    logger.error(`API Error ${String(status)}: ${axiosError.config?.url}`, JSON.stringify(axiosError.response?.data));
                }

                return Promise.reject(axiosError);
            }
        );
    }

    public get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.instance.get<T>(url, config);
    }

    public post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.instance.post<T>(url, data, config);
    }

    public put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.instance.put<T>(url, data, config);
    }

    public delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.instance.delete<T>(url, config);
    }

    public patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.instance.patch<T>(url, data, config);
    }
}

export const apiClient = new ApiClient();
export default apiClient;
