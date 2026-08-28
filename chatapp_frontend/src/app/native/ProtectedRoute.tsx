'use client';

import type { ReactNode } from 'react';
import { NativeRouteShell } from './NativeRouteShell';
import { ProtectedRoute as AuthenticatedRoute } from '@/app/router/guards/ProtectedRoute';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <NativeRouteShell sessionAware>
      <AuthenticatedRoute>{children}</AuthenticatedRoute>
    </NativeRouteShell>
  );
}
