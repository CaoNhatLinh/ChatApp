'use client';

import { X } from 'lucide-react';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { localizeText } from '@/shared/i18n';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={10}
      containerStyle={{ top: 14, left: 14, right: 14, zIndex: 'var(--z-toast)' }}
      toastOptions={{
        duration: 2800,
        style: {
          maxWidth: 'min(25rem, calc(100vw - 1.75rem))',
          padding: 0,
          color: 'var(--popover-foreground)',
          background: 'transparent',
          border: 0,
          boxShadow: 'none',
        },
        error: { duration: 5200 },
      }}
    >
      {(activeToast) => (
        <ToastBar toast={activeToast}>
          {({ icon, message }) => (
            <div className="noi-toast" data-tone={activeToast.type}>
              <span className="noi-toast-signal" aria-hidden="true" />
              <span className="noi-toast-icon" aria-hidden="true">{icon}</span>
              <div className="min-w-0 flex-1 text-sm font-medium leading-5">{message}</div>
              {activeToast.type !== 'loading' ? (
                <button
                  type="button"
                  className="noi-toast-close"
                  onClick={() => toast.dismiss(activeToast.id)}
                  aria-label={localizeText('Đóng thông báo')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}

export default AppToaster;
