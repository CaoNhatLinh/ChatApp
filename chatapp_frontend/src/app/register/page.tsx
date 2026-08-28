'use client';

import RegisterPage from '@/route-pages/RegisterPage';
import AuthRoute from '@/app/native/AuthRoute';

export default function RegisterRoute() {
  return <AuthRoute><RegisterPage /></AuthRoute>;
}
