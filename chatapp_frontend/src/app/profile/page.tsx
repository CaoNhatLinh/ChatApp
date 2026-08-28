'use client';

import ProfilePage from '@/route-pages/ProfilePage';
import ProtectedRoute from '@/app/native/ProtectedRoute';

export default function ProfileRoute() {
  return <ProtectedRoute><ProfilePage /></ProtectedRoute>;
}
