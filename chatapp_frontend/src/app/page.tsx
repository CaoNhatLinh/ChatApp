'use client';

import HomePage from '@/route-pages/HomePage';
import PublicRoute from '@/app/native/PublicRoute';
import { AuthRedirect } from '@/app/router/guards/AuthRedirect';

export default function HomeRoute() {
  return (
    <PublicRoute sessionAware>
      <AuthRedirect>
        <HomePage />
      </AuthRedirect>
    </PublicRoute>
  );
}
