// src/App.tsx
import { AppRoutes } from "@/router/routes";
import { AuthProvider } from "@/context/AuthContext";
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { PresenceManager } from '@/components/PresenceManager';

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