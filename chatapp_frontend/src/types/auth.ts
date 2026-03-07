export type AuthToken = {
  token: string;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  display_name: string;
};
export type AuthResponse = {
  token: string;
  userId: string;
  userName: string;
  displayName: string;
  nickName?: string;
  avatarUrl?: string;
};

export type User = {
  userId: string;
  userName: string;
  nickName?: string;
  displayName: string;
  avatarUrl?: string;
  status?: "online" | "offline" | "away";
  /** Persistent status preference: ONLINE, DND, INVISIBLE */
  statusPreference?: 'ONLINE' | 'DND' | 'INVISIBLE';
  session_id?: string;
};