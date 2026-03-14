import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/app/router/guards/ProtectedRoute";
import { AuthRedirect } from "@/app/router/guards/AuthRedirect";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";

// Lazy load Pages for Code Splitting
const LoginPage = React.lazy(() => import("@/pages/LoginPage"));
const RegisterPage = React.lazy(() => import("@/pages/RegisterPage"));
const MessengerPage = React.lazy(() => import("@/pages/MessengerPage"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen w-full bg-[#111b21]">
    <LoadingSpinner size="lg" />
  </div>
);

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthRedirect>
                <LoginPage />
              </AuthRedirect>
            }
          />
          <Route
            path="/register"
            element={
              <AuthRedirect>
                <RegisterPage />
              </AuthRedirect>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MessengerPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
