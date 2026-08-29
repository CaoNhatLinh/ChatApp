import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../lib/logger';
import { runtimeEnv } from '../config/runtimeEnv';
import { clearAccessToken, clearSessionHint, getAccessToken, hasSessionHint, setAccessToken } from '../auth/access-token';

const API_BASE_URL = runtimeEnv.apiBaseUrl;

class ApiClient {
    private instance: AxiosInstance;
    private refreshRequest: Promise<string> | null = null;

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
                const token = getAccessToken();
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }

                if (runtimeEnv.isDevelopment) {
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
                if (runtimeEnv.isDevelopment) {
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

                if (status === 401 && typeof window !== 'undefined') {
                    const config = axiosError.config as (AxiosRequestConfig & { _authRetry?: boolean }) | undefined;
                    const isAuthEndpoint = config?.url?.includes('/auth/login')
                        || config?.url?.includes('/auth/register')
                        || config?.url?.includes('/auth/refresh')
                        || config?.url?.includes('/auth/logout');
                    if (config && !config._authRetry && !isAuthEndpoint && (getAccessToken() || hasSessionHint())) {
                        config._authRetry = true;
                        try {
                            await this.refreshAccessToken();
                            return await this.instance(config);
                        } catch (refreshError) {
                            logger.warn('Refresh token rejected; clearing in-memory session');
                            clearAccessToken();
                            clearSessionHint();
                            window.location.href = '/login';
                            return Promise.reject(refreshError instanceof Error ? refreshError : new Error(String(refreshError)));
                        }
                    }

                    if (!isAuthEndpoint) {
                        logger.warn('Unauthorized access - session expired');
                        clearAccessToken();
                        clearSessionHint();
                        window.location.href = '/login';
                    }
                }

                if (runtimeEnv.isDevelopment) {
                    logger.warn('API request rejected', {
                        status,
                        method: axiosError.config?.method?.toUpperCase(),
                        url: axiosError.config?.url,
                    });
                }

                return Promise.reject(axiosError);
            }
        );
    }

    private refreshAccessToken(): Promise<string> {
        if (!this.refreshRequest) {
            this.refreshRequest = this.instance.post<{ accessToken: string }>('/auth/refresh')
                .then((response) => {
                    setAccessToken(response.data.accessToken);
                    return response.data.accessToken;
                })
                .finally(() => {
                    this.refreshRequest = null;
                });
        }

        return this.refreshRequest;
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
