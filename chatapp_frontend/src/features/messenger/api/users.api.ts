import apiClient from '@/common/lib/api-client';
import type { User } from '@/features/auth/types/auth.types';

export const searchUsers = async (keyword: string): Promise<User[]> => {
    try {
        const response = await apiClient.get<User>('/users/search', {
            params: { q: keyword }
        });

        // The backend returns a single UserDTO for now based on UserController
        // We wrap it in an array to match the expected dropdown UI behavior
        if (response.data) {
            return [response.data];
        }
        return [];
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
};
