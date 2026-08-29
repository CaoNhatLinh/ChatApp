'use client';

import ProtectedRoute from '@/app/native/ProtectedRoute';
import CommunityDiscoveryPage from '@/route-pages/CommunityDiscoveryPage';

export default function CommunitiesRoute() {
  return <ProtectedRoute><CommunityDiscoveryPage /></ProtectedRoute>;
}
