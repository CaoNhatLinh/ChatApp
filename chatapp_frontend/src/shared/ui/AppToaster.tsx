'use client';

import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerStyle={{ top: 12, left: 12, right: 12, zIndex: 90 }}
      toastOptions={{
        duration: 3200,
        style: {
          maxWidth: 'min(28rem, calc(100vw - 1.5rem))',
          padding: '10px 12px',
          borderRadius: '12px',
          lineHeight: '1.35',
        },
        error: { duration: 5000 },
      }}
    />
  );
}

export default AppToaster;
