// src/App.tsx
import { AppRoutes } from "@/app/router";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useEffect } from 'react';
import { PresenceManager } from '@/app/providers/PresenceManager';

function App() {
  const initializeAuth = useAuthStore(state => state.initializeAuth);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return (
    <AuthProvider>
      <PresenceManager />
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
