import { useState, useEffect } from 'react';
import { searchUsers } from '@/features/profile/api/users.api';
import type { User } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';

export type SearchableUser = User & { requestSent?: boolean };

export const useUserSearch = (searchTerm: string, delay: number = 500) => {
    const [searchResults, setSearchResults] = useState<SearchableUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const { user: currentUser } = useAuthStore();

    useEffect(() => {
        let active = true;
        const fetchUsers = async () => {
            if (searchTerm.trim().length < 2) {
                if (active) {
                    setSearchResults([]);
                    setSearchError(null);
                }
                return;
            }

            if (active) {
                setIsSearching(true);
                setSearchError(null);
            }
            try {
                const results = await searchUsers(searchTerm);
                if (!active) return;
                // Filter out current user
                setSearchResults(results.filter((user) => user.userId !== currentUser?.userId));
            } catch (error: unknown) {
                if (!active) return;
                logger.error("[useUserSearch] Failed to search users", error instanceof Error ? error.message : String(error));
                setSearchResults([]);
                setSearchError(getUserFacingErrorMessage(error, localizeText("Không thể tìm kiếm người dùng. Kiểm tra kết nối và thử lại.")));
            } finally {
                if (active) setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchUsers, delay);
        return () => {
            active = false;
            clearTimeout(timeoutId);
        };
    }, [searchTerm, currentUser?.userId, delay]);

    return { searchResults, isSearching, searchError, setSearchResults };
};
