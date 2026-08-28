'use client';

import type { ReactNode } from 'react';
import { NativeRouteShell } from './NativeRouteShell';

export default function PublicRoute({ children, sessionAware = false }: { children: ReactNode; sessionAware?: boolean }) {
  return <NativeRouteShell sessionAware={sessionAware}>{children}</NativeRouteShell>;
}
