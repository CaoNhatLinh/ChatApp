import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { register as registerApi } from '../api/auth.api';
import type { RegisterRequest } from '../types/auth.types';
import { logger } from '@/common/lib/logger';
import { toast } from 'react-hot-toast';

export const useRegister = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleRegister = async (data: RegisterRequest) => {
        setLoading(true);
        setError(null);

        try {
            logger.debug('Attempting registration...', data.username);
            await registerApi(data);

            toast.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');

            // Delay slightly for user to see the success toast
            setTimeout(() => {
                void navigate('/login');
            }, 1500);
        } catch (err: unknown) {
            let message = 'Đăng ký thất bại. Tên đăng nhập có thể đã tồn tại.';
            if (axios.isAxiosError(err)) {
                const responseData = err.response?.data as { message?: string } | undefined;
                if (responseData?.message) {
                    message = String(responseData.message);
                }
            }
            setError(message);
            toast.error(message);
            logger.error('Registration error', err);
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
