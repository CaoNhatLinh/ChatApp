import React from 'react';
import { AuthLayout } from '@/features/auth/ui/AuthLayout';
import { Login } from '@/features/auth/Login';

export const LoginPage: React.FC = () => {
  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Chào mừng trở lại! Vui lòng nhập thông tin để tiếp tục trò chuyện."
    >
      <Login />
    </AuthLayout>
  );
};

export default LoginPage;
