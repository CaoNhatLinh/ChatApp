import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface AuthRedirectProps {
  children: React.ReactNode;
}

export const AuthRedirect: React.FC<AuthRedirectProps> = ({ children }) => {
  const { user, loading, token } = useAuthStore();
  const location = useLocation();

  // Show loading spinner while auth is being initialized
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated, redirect to home or the intended page
  if (token && user) {
    const state = location.state as { from?: { pathname?: string } } | null;
    const from = state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  // If not authenticated, show the auth page (login/register)
  return <>{children}</>;
};
