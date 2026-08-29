export interface AuthResponse {
    token: string;
    userId: string;
    userName: string;
    displayName: string;
    avatarUrl?: string;
}

export interface User {
    userId: string;
    userName: string;
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
    email: string;
    password: string;
    displayName: string;
}
