import axios from 'axios';
import { localizeText } from '@/shared/i18n';

type AuthOperation = 'login' | 'register';

interface ErrorPayload {
  code?: unknown;
  message?: unknown;
}

const getPayload = (error: unknown): { status?: number; code: string; message: string } => {
  if (!axios.isAxiosError(error)) {
    return { code: '', message: '' };
  }

  const payload = error.response?.data as ErrorPayload | undefined;
  return {
    status: error.response?.status,
    code: typeof payload?.code === 'string' ? payload.code.toUpperCase() : '',
    message: typeof payload?.message === 'string' ? payload.message.toLowerCase() : '',
  };
};

/** Maps canonical API errors to stable, bilingual product copy. Never exposes raw server text. */
export const getAuthErrorMessage = (error: unknown, operation: AuthOperation): string => {
  const { status, code, message } = getPayload(error);
  const isInvalidCredentials = operation === 'login'
    && (message.includes('invalid credentials') || (status === 403 && code === 'FORBIDDEN'));
  if (isInvalidCredentials) {
    return localizeText('Tên đăng nhập hoặc mật khẩu không đúng.');
  }

  if (message.includes('account is not active') || message.includes('user account is unavailable')) {
    return localizeText('Tài khoản hiện không hoạt động. Vui lòng liên hệ hỗ trợ.');
  }

  if (operation === 'register' && (message.includes('username already exists') || message.includes('email already exists'))) {
    return localizeText('Tên đăng nhập hoặc email đã được sử dụng.');
  }

  if (message.includes('password must have at least 8 chars')) {
    return localizeText('Mật khẩu phải có ít nhất 8 ký tự.');
  }

  if (message.includes('username/password required')) {
    return localizeText('Vui lòng nhập tên đăng nhập và mật khẩu.');
  }

  if (operation === 'register' && message.includes('username and email are required')) {
    return localizeText('Vui lòng nhập tên đăng nhập và email.');
  }

  return localizeText(
    operation === 'login'
      ? 'Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.'
      : 'Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại.',
  );
};
