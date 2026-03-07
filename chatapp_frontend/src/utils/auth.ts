// src/utils/auth.ts

/**
 * JWT Payload structure from backend
 */
interface JwtPayload {
  sub: string;
  userId: string;
  exp: number;
  iat: number;
}

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Set authentication token to localStorage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('token', token);
};

/**
 * Remove authentication token from localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('token');
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  return token !== null && token.trim().length > 0;
};

/**
 * Decode JWT token (without verification)
 */
export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch (error) {
    console.error('Error decoding token:', error instanceof Error ? error.message : error);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token?: string): boolean => {
  const tokenToCheck = token ?? getAuthToken();
  if (!tokenToCheck) return true;

  const decoded = decodeToken(tokenToCheck);
  if (!decoded) return true;

  const currentTime = Date.now() / 1000;
  return decoded.exp < currentTime;
};

/**
 * Get user info from token
 */
export const getUserFromToken = (): { userId: string; username: string } | null => {
  const token = getAuthToken();
  if (!token || isTokenExpired(token)) return null;

  const decoded = decodeToken(token);
  if (!decoded) return null;

  return {
    userId: decoded.userId,
    username: decoded.sub
  };
};
