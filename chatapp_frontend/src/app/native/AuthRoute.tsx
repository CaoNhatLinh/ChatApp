'use client';

import type { ReactNode } from 'react';
import { NativeRouteShell } from './NativeRouteShell';
import { AuthRedirect } from '@/app/router/guards/AuthRedirect';

export default function AuthRoute({ children }: { children: ReactNode }) {
  return (
    <NativeRouteShell sessionAware>
      <AuthRedirect>{children}</AuthRedirect>
    </NativeRouteShell>
  );
}
