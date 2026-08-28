'use client';

import FriendsPage from '@/route-pages/FriendsPage';
import ProtectedRoute from '@/app/native/ProtectedRoute';

export default function FriendsRoute() {
  return <ProtectedRoute><FriendsPage /></ProtectedRoute>;
}
