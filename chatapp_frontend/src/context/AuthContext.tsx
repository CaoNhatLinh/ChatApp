// src/context/AuthContext.tsx
import { createContext, useContext } from 'react';
import { useAuthStore } from '@/store/authStore';

// Tạo context cho các component cần truy cập trực tiếp
const AuthContext = createContext(useAuthStore.getState());

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const authState = useAuthStore();

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);