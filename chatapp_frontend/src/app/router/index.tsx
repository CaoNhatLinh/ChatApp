import React, { Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/app/router/guards/ProtectedRoute";
import { AuthRedirect } from "@/app/router/guards/AuthRedirect";
import { LoadingSpinner } from "@/shared/ui/LoadingSpinner";
import { useAuthStore } from "@/features/auth/model/auth.store";

const LoginPage = React.lazy(() => import("@/pages/LoginPage"));
const RegisterPage = React.lazy(() => import("@/pages/RegisterPage"));
const MessengerPage = React.lazy(() => import("@/pages/MessengerPage"));
const MessagesPage = React.lazy(() => import("@/pages/MessagesPage"));
const FriendsPage = React.lazy(() => import("@/pages/FriendsPage"));
const SettingsPage = React.lazy(() => import("@/pages/SettingsPage"));
const SearchPage = React.lazy(() => import("@/pages/SearchPage"));
const ActivityPage = React.lazy(() => import("@/pages/ActivityPage"));
const HomePage = React.lazy(() => import("@/pages/HomePage"));
const AboutPage = React.lazy(() => import("@/pages/AboutPage"));
const HelpPage = React.lazy(() => import("@/pages/HelpPage"));
const PrivacyPage = React.lazy(() => import("@/pages/PrivacyPage"));
const TermsPage = React.lazy(() => import("@/pages/terms/TermsPage"));
const ProfilePage = React.lazy(() => import("@/pages/ProfilePage"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));

const PageLoader = () => (
  <div className="page-shell flex items-center justify-center h-screen w-full">
    <LoadingSpinner size="lg" />
  </div>
);

const HomeEntry = () => {
  const { user, loading, token } = useAuthStore();

  if (loading) {
    return <PageLoader />;
  }

  if (token && user) {
    return <Navigate to="/app" replace />;
  }

  return <HomePage />;
};

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomeEntry />} />
          <Route path="/home" element={<HomeEntry />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="/not-found" element={<NotFound />} />
          <Route
            path="/about"
            element={<AboutPage />}
          />
          <Route
            path="/help"
            element={<HelpPage />}
          />
          <Route
            path="/privacy"
            element={<PrivacyPage />}
          />
          <Route
            path="/terms"
            element={<TermsPage />}
          />
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
            path="/app"
            element={
              <ProtectedRoute>
                <MessengerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <ActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
