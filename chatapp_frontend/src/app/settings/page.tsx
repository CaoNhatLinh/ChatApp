'use client';

import SettingsPage from '@/route-pages/SettingsPage';
import ProtectedRoute from '@/app/native/ProtectedRoute';

export default function SettingsRoute() {
  return <ProtectedRoute><SettingsPage /></ProtectedRoute>;
}
