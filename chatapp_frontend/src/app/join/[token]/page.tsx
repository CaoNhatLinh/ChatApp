'use client';

import JoinInvitePage from '@/route-pages/JoinInvitePage';
import PublicRoute from '@/app/native/PublicRoute';
import { use } from 'react';

export default function JoinInviteRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <PublicRoute sessionAware>
      <JoinInvitePage token={token} />
    </PublicRoute>
  );
}
