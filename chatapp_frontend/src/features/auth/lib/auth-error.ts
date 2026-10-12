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
  if (message.includes('account is not active') || message.includes('user account is unavailable')) {
    return localizeText('Tài khoản hiện không hoạt động. Vui lòng liên hệ hỗ trợ.');
  }

  const isInvalidCredentials = operation === 'login'
    && (message.includes('invalid credentials') || (status === 403 && code === 'FORBIDDEN'));
  if (isInvalidCredentials) {
    return localizeText('Tên đăng nhập hoặc mật khẩu không đúng.');
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

export const getGoogleAuthErrorMessage = (error: unknown): string => {
  const { code } = getPayload(error);
  const firebaseCode = error && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string' ? error.code : '';

  if (code === 'ACCOUNT_LINK_REQUIRED') {
    return localizeText('Email này đã có tài khoản Nối. Hãy đăng nhập bằng mật khẩu rồi liên kết Google trong cài đặt.');
  }
  if (code === 'USERNAME_UNAVAILABLE') {
    return localizeText('Tên đăng nhập này đã có người dùng. Hãy chọn một tên khác.');
  }
  if (code === 'ACCOUNT_UNAVAILABLE') {
    return localizeText('Tài khoản hiện không hoạt động. Vui lòng liên hệ hỗ trợ.');
  }
  if (code === 'ACCOUNT_SETUP_PENDING') {
    return localizeText('Nối đang hoàn tất tài khoản của bạn. Chờ một chút rồi thử lại.');
  }
  if (code === 'GOOGLE_AUTH_UNAVAILABLE') {
    return localizeText('Đăng nhập Google đang tạm nghỉ. Bạn vẫn có thể dùng mật khẩu.');
  }
  if (code === 'GOOGLE_TOKEN_INVALID') {
    return localizeText('Phiên Google đã hết hạn. Hãy chọn tài khoản Google lần nữa.');
  }
  if (code === 'REAUTHENTICATION_REQUIRED') {
    return localizeText('Mật khẩu chưa đúng hoặc phiên Google đã cũ. Hãy xác minh lại.');
  }
  if (code === 'GOOGLE_EMAIL_MISMATCH') {
    return localizeText('Hãy chọn tài khoản Google dùng cùng email với tài khoản Nối này.');
  }
  if (code === 'IDENTITY_ALREADY_LINKED') {
    return localizeText('Tài khoản Google này đã được nối với một tài khoản khác.');
  }
  if (firebaseCode === 'auth/network-request-failed') {
    return localizeText('Không kết nối được với Google. Kiểm tra mạng rồi thử lại.');
  }
  if (firebaseCode === 'auth/unauthorized-domain') {
    return localizeText('Tên miền này chưa được cho phép đăng nhập Google.');
  }
  return localizeText('Chưa thể đăng nhập bằng Google. Hãy thử lại hoặc dùng mật khẩu.');
};
