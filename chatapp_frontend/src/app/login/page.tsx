'use client';

import LoginPage from '@/route-pages/LoginPage';
import AuthRoute from '@/app/native/AuthRoute';

export default function LoginRoute() {
  return <AuthRoute><LoginPage /></AuthRoute>;
}
