import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { login as loginApi } from '../api/auth.api';
import type { LoginRequest } from '../types/auth.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logger } from '@/shared/lib/logger';
import { toast } from 'react-hot-toast';

export const useLogin = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

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

            toast.success(`Chào mừng trở lại, ${response.displayName}!`);

            // Cast the location state safely to extract the 'from' path
            const state = location.state as { from?: { pathname?: string } } | null;
            const from = state?.from?.pathname || '/';
            void navigate(from, { replace: true });
        } catch (err: unknown) {
            let message = 'Tên đăng nhập hoặc mật khẩu không đúng.';
            if (axios.isAxiosError(err)) {
                const responseData = err.response?.data as { message?: string } | undefined;
                if (responseData?.message) {
                    message = String(responseData.message);
                }
            }
            setError(message);
            toast.error(message);
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
