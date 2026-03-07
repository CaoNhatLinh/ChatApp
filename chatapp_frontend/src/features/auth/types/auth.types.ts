export interface AuthResponse {
    token: string;
    userId: string;
    userName: string;
    displayName: string;
    nickName?: string;
    avatarUrl?: string;
}

export interface User {
    userId: string;
    userName: string;
    nickName?: string;
    displayName: string;
    avatarUrl?: string;
    statusPreference?: 'ONLINE' | 'DND' | 'INVISIBLE';
    session_id?: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    display_name: string;
}
