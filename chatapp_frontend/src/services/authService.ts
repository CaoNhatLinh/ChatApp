import type { RegisterRequest, User } from "@/types/auth";
import api from "@/lib/axios";
import { logger } from "@/utils/logger";

export const authService = {
  login: async (username: string, password: string) => {
    const res = await api.post("/auth/login", { username, password });
    if (res.status < 200 || res.status >= 300) {
      throw new Error("Login failed");
    }
    return (res.data as { token: string }).token;
  },

  logout: async () => {
    await api.post("/auth/logout");
  },

  register: async (form: RegisterRequest) => {
    logger.debug("Registering user");
    const res = await api.post("/auth/register", form);
    logger.debug("Registration successful");
    return (res.data as { user: User }).user;
  },
  getCurrentUser: async (token: string): Promise<User> => {
    if (!token) throw new Error("No token found");

    try {
      const res = await api.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      });
      return res.data as User;
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { status?: number } }).response === "object" &&
        (err as { response?: { status?: number } }).response !== null &&
        ((err as { response?: { status?: number } }).response as { status?: number }).status !== undefined &&
        (
          ((err as { response?: { status?: number } }).response as { status?: number }).status === 401 ||
          ((err as { response?: { status?: number } }).response as { status?: number }).status === 403
        )
      ) {
        throw new Error("Unauthorized");
      }
      logger.error("getCurrentUser failed:", err);
      throw new Error("Failed to fetch user info");
    }
  }
};
