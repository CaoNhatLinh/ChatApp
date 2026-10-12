import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../lib/logger';
import { runtimeEnv } from '../config/runtimeEnv';
import { clearAccessToken, clearSessionHint, getAccessToken, getSessionGeneration, hasSessionHint, setAccessToken, SessionChangedError } from '../auth/access-token';

const API_BASE_URL = runtimeEnv.apiBaseUrl;

type SessionRequestConfig = InternalAxiosRequestConfig & {
    _authRetry?: boolean;
    _sessionGeneration?: number;
};

const isStaleSessionRequest = (config: SessionRequestConfig | undefined): boolean =>
    config?._sessionGeneration !== undefined && config._sessionGeneration !== getSessionGeneration();

class ApiClient {
    private instance: AxiosInstance;
    private refreshRequest: { generation: number; promise: Promise<string> } | null = null;

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
                const sessionConfig = config as SessionRequestConfig;
                if (isStaleSessionRequest(sessionConfig)) throw new SessionChangedError();
                sessionConfig._sessionGeneration = getSessionGeneration();
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
                if (isStaleSessionRequest(response.config as SessionRequestConfig)) throw new SessionChangedError();
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
                const config = axiosError.config as SessionRequestConfig | undefined;
                if (isStaleSessionRequest(config)) return Promise.reject(new SessionChangedError());

                if (status === 401 && typeof window !== 'undefined') {
                    const isCredentialEndpoint = config?.url?.includes('/auth/login')
                        || config?.url?.includes('/auth/register')
                        || config?.url?.includes('/auth/google/exchange')
                        || config?.url?.includes('/auth/google/register')
                        || config?.url?.includes('/auth/refresh')
                        || config?.url?.includes('/auth/logout');
                    const responseData = axiosError.response?.data as unknown;
                    const responseCode = typeof responseData === 'object'
                        && responseData !== null
                        && 'code' in responseData
                        && typeof responseData.code === 'string'
                        ? responseData.code
                        : '';
                    const isIdentityConfirmationFailure = responseCode === 'REAUTHENTICATION_REQUIRED'
                        || responseCode === 'GOOGLE_TOKEN_INVALID';
                    if (config && !config._authRetry && !isCredentialEndpoint
                        && !isIdentityConfirmationFailure && (getAccessToken() || hasSessionHint())) {
                        config._authRetry = true;
                        try {
                            await this.refreshAccessToken();
                        } catch (refreshError) {
                            const refreshStatus = axios.isAxiosError(refreshError)
                                ? refreshError.response?.status
                                : undefined;
                            if (refreshStatus === 401 || refreshStatus === 403) {
                                logger.warn('Refresh token rejected; clearing in-memory session');
                                clearAccessToken();
                                clearSessionHint();
                                window.location.href = '/login';
                            }
                            // A transport outage is recoverable and does not revoke the session.
                            return Promise.reject(refreshError instanceof Error ? refreshError : new Error(String(refreshError)));
                        }
                        // Replay errors belong to the operation, not the successful refresh.
                        return this.instance(config);
                    }

                    if (!isCredentialEndpoint && !isIdentityConfirmationFailure) {
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

    public refreshAccessToken(): Promise<string> {
        const generation = getSessionGeneration();
        if (!this.refreshRequest || this.refreshRequest.generation !== generation) {
            const request: Promise<string> = this.instance.post<{ accessToken: string }>('/auth/refresh')
                .then((response) => {
                    if (generation !== getSessionGeneration()) throw new SessionChangedError();
                    setAccessToken(response.data.accessToken);
                    return response.data.accessToken;
                })
                .finally(() => {
                    if (this.refreshRequest?.promise === request) this.refreshRequest = null;
                });
            this.refreshRequest = { generation, promise: request };
        }

        return this.refreshRequest.promise;
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
