import React from 'react';
import { AuthLayout } from '@/common/components/layouts/AuthLayout';
import { Register } from '@/features/auth/Register';

export const RegisterPage: React.FC = () => {
  return (
    <AuthLayout
      title="Đăng ký tài khoản"
      subtitle="Tạo ngay một tài khoản để kết nối với bạn bè của bạn."
    >
      <Register />
    </AuthLayout>
  );
};

export default RegisterPage;
