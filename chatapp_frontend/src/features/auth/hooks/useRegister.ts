import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register as registerApi } from '../api/auth.api';
import type { RegisterRequest } from '../types/auth.types';
import { logger } from '@/shared/lib/logger';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { getAuthErrorMessage } from '@/features/auth/lib/auth-error';
import { localizeText } from '@/shared/i18n';

export const useRegister = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();

    const handleRegister = async (data: RegisterRequest) => {
        setLoading(true);
        setError(null);

        try {
            logger.debug('Attempting registration...', data.username);
            await registerApi(data);

            notifySuccess(localizeText('Đăng ký tài khoản thành công! Vui lòng đăng nhập.'));

            // Delay slightly for user to see the success toast
            setTimeout(() => {
                router.replace('/login');
            }, 1500);
        } catch (err: unknown) {
            const message = getAuthErrorMessage(err, 'register');
            setError(message);
            notifyError(message);
            logger.error('Registration error', err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return {
        handleRegister,
        loading,
        error,
    };
};
