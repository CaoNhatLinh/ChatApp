import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { login as loginApi } from '../api/auth.api';
import type { LoginRequest } from '../types/auth.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logger } from '@/shared/lib/logger';
import { notifyError, notifySuccess } from '@/shared/lib/notification';

export const useLogin = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuthStore();
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleLogin = async (data: LoginRequest) => {
        setLoading(true);
        setError(null);

        try {
            logger.debug('Attempting login...', data.username);
            const response = await loginApi(data);

            if (!response.token) {
                throw new Error('No token received from server');
            }

            await login(response.token);

            notifySuccess(`Chào mừng trở lại, ${response.displayName}!`);

            // Cast the location state safely to extract the 'from' path
            const requestedPath = searchParams.get('from');
            const from = requestedPath?.startsWith('/') ? requestedPath : '/app';
            router.replace(from);
        } catch (err: unknown) {
            let message = 'Tên đăng nhập hoặc mật khẩu không đúng.';
            if (axios.isAxiosError(err)) {
                const responseData = err.response?.data as { message?: string } | undefined;
                if (responseData?.message) {
                    message = String(responseData.message);
                }
            }
            setError(message);
            notifyError(message);
            logger.error('Login error', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        handleLogin,
        loading,
        error,
    };
};
