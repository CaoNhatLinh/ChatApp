'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { localizeText, useAppLocale } from '@/shared/i18n';

export const NetworkStatusBanner = () => {
  useAppLocale();
  const [isOffline, setIsOffline] = useState(() => (
    typeof navigator !== 'undefined' && !navigator.onLine
  ));

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed inset-x-4 top-4 z-[100] mx-auto flex max-w-md items-start gap-3 rounded-[var(--radius-md)] border border-warning/40 bg-background/95 px-4 py-3 text-warning shadow-lg backdrop-blur"
      role="status"
      aria-live="assertive"
    >
      <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{localizeText('Mất kết nối mạng')}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {localizeText('Kiểm tra kết nối để tiếp tục.')}
        </p>
      </div>
    </div>
  );
};

export default NetworkStatusBanner;
