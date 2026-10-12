import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login as loginApi } from '../api/auth.api';
import type { LoginRequest } from '../types/auth.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logger } from '@/shared/lib/logger';
import { getAuthErrorMessage } from '@/features/auth/lib/auth-error';
import { safeReturnPath } from '@/features/auth/lib/safe-return-path';

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

            router.replace(safeReturnPath(searchParams.get('from')));
        } catch (err: unknown) {
            const message = getAuthErrorMessage(err, 'login');
            setError(message);
            logger.error('Login error', err instanceof Error ? err.message : String(err));
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
