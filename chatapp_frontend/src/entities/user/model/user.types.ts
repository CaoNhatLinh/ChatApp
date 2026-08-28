export interface UserDTO {
  userId: string;
  userName: string;
  displayName: string;
  nickName?: string;
  avatarUrl?: string;
  createdAt?: string;
  status: string;
  lastActive?: string | null;
}

