import { useState, useEffect } from 'react';
import { searchUsers } from '@/features/profile/api/users.api';
import type { User } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { localizeText } from '@/shared/i18n';

export type SearchableUser = User & { requestSent?: boolean };

export const useUserSearch = (searchTerm: string, delay: number = 500) => {
    const [searchResults, setSearchResults] = useState<SearchableUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const { user: currentUser } = useAuthStore();

    useEffect(() => {
        const fetchUsers = async () => {
            if (searchTerm.trim().length < 2) {
                setSearchResults([]);
                setSearchError(null);
                return;
            }

            setIsSearching(true);
            setSearchError(null);
            try {
                const results = await searchUsers(searchTerm);
                // Filter out current user
                setSearchResults(results.filter((user) => user.userId !== currentUser?.userId));
            } catch (error) {
                console.error("Failed to search users", error);
                setSearchResults([]);
                setSearchError(localizeText("Không thể tìm kiếm người dùng. Kiểm tra kết nối và thử lại."));
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchUsers, delay);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, currentUser?.userId, delay]);

    return { searchResults, isSearching, searchError, setSearchResults };
};
