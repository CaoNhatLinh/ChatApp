import api from "@/lib/axios";
import type { UserDTO } from '@/types/user';
import type { User } from '@/types/auth';

export interface UpdateProfileRequest {
  displayName?: string;
  avatarUrl?: string;
  nickname?: string;
}

// 👤 Get user profile by ID
export const getUserProfile = async (
  userId: string
): Promise<UserDTO> => {
  const res = await api.get<UserDTO>(`/users/profile/${userId}`);
  return res.data;
};

// 🛠️ Update current user profile
export const updateProfile = async (data: UpdateProfileRequest): Promise<User> => {
  const res = await api.patch<User>("/users/profile", data);
  return res.data;
};

// 🔍 Search users by query (new backend format)
export const searchUsersNew = async (
  query: string
): Promise<UserDTO[]> => {
  const res = await api.get<UserDTO[]>(`/users/search`, {
    params: { q: query },
  });
  return res.data;
};
