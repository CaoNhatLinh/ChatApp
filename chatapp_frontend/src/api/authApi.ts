import api from "@/lib/axios";
import type { AuthResponse, LoginRequest, RegisterRequest, User } from "@/types/auth";

/**
 * 🔐 Login user
 * Backend: POST /api/auth/login
 * Returns: { token, user }
 */
export const login = async (loginRequest: LoginRequest): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>("/auth/login", loginRequest);
  if (res.status < 200 || res.status >= 300) throw new Error("Login failed");
  return res.data;
};

/**
 * 📝 Register new user
 * Backend: POST /api/auth/register
 * Returns: User object
 */
export const register = async (data: RegisterRequest): Promise<User> => {
  const res = await api.post<User>("/auth/register", data);
  return res.data;
};

/**
 * 🚪 Logout user
 * Backend: POST /api/auth/logout
 */
export const logout = async (): Promise<void> => {
  await api.post("/auth/logout");
};

/**
 * 👤 Get current user info
 * Backend: GET /api/auth/me
 * Requires: JWT token in Authorization header
 */
export const getCurrentUser = async (): Promise<User> => {
  const res = await api.get<User>('/auth/me');
  return res.data;
};

/**
 * 🔄 Refresh token (if implemented)
 * Backend: POST /api/auth/refresh
 */
export const refreshToken = async (): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/refresh');
  return res.data;
};
