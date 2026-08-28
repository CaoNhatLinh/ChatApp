'use client';

import HomePage from '@/route-pages/HomePage';
import PublicRoute from '@/app/native/PublicRoute';

export default function HomeRoute() {
  return (
    <PublicRoute>
      <HomePage />
    </PublicRoute>
  );
}
