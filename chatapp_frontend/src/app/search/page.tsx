'use client';

import SearchPage from '@/route-pages/SearchPage';
import ProtectedRoute from '@/app/native/ProtectedRoute';

export default function SearchRoute() {
  return <ProtectedRoute><SearchPage /></ProtectedRoute>;
}
