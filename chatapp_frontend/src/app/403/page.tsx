'use client';

import ForbiddenPage from '@/route-pages/ForbiddenPage';
import PublicRoute from '@/app/native/PublicRoute';

export default function ForbiddenRoute() {
  return <PublicRoute><ForbiddenPage /></PublicRoute>;
}
