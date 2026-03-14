import { useState, useEffect } from 'react';
import { searchUsers } from '@/features/profile/api/users.api';
import type { User } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';

export type SearchableUser = User & { requestSent?: boolean };

export const useUserSearch = (searchTerm: string, delay: number = 500) => {
    const [searchResults, setSearchResults] = useState<SearchableUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const { user: currentUser } = useAuthStore();

    useEffect(() => {
        const fetchUsers = async () => {
            if (searchTerm.trim().length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchUsers(searchTerm);
                // Filter out current user
                setSearchResults(results.filter((user) => user.userId !== currentUser?.userId));
            } catch (error) {
                console.error("Failed to search users", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchUsers, delay);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, currentUser?.userId, delay]);

    return { searchResults, isSearching, setSearchResults };
};
