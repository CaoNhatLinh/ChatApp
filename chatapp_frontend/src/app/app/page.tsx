'use client';

import MessengerPage from '@/route-pages/MessengerPage';
import ProtectedRoute from '@/app/native/ProtectedRoute';

export default function MessengerRoute() {
  return <ProtectedRoute><MessengerPage /></ProtectedRoute>;
}
