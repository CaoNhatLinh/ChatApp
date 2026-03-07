import { create } from 'zustand';
import { friendApi } from '@/api/friendApi';
import { searchUsersNew as searchUsersApi } from '@/api/userApi';
import { logger } from '@/utils/logger';
import type { FriendDetails } from '@/types/friend';
import type { UserDTO } from '@/types';

interface FriendStoreState {
  friends: FriendDetails | null;

  pendingRequests: FriendDetails | null;
  receivedRequests: FriendDetails | null;
  loading: boolean;
  error: string | null;
  searchResults: (UserDTO & { isFriend?: boolean; requestSent?: boolean })[];
  blockedUserIds: Set<string>;
}

interface FriendStoreActions {
  searchUsers: (username: string) => Promise<void>;
  fetchFriends: (userId: string) => Promise<void>;
  fetchSentRequests: (userId: string) => Promise<void>;
  fetchReceivedRequests: (userId: string) => Promise<void>;
  handleAccept: (userId: string, friendId: string) => Promise<void>;
  handleReject: (userId: string, friendId: string) => Promise<void>;
  blockFriend: (userId: string, friendId: string) => Promise<void>;
  unblockFriend: (userId: string, friendId: string) => Promise<void>;
  sendFriendRequest: (userId: string, friendId: string) => Promise<void>;
  fetchBlockedUsers: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState: FriendStoreState = {
  friends: null,
  pendingRequests: null,
  receivedRequests: null,
  loading: false,
  error: null,
  searchResults: [],
  blockedUserIds: new Set<string>(),
};

export const useFriendStore = create<FriendStoreState & FriendStoreActions>((set, get) => ({
  ...initialState,

  sendFriendRequest: async (userId: string, friendId: string) => {
    set({ loading: true, error: null });
    try {
      await friendApi.sendRequest(userId, friendId);
      set((state) => ({
        pendingRequests: state.pendingRequests,
        error: null,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) || 'Failed to send friend request' });
    } finally {
      set({ loading: false });
    }
  },
  fetchReceivedRequests: async (userId: string) => {
    logger.debug('Fetching received requests for user');
    set({ loading: true, error: null });
    try {
      const response = await friendApi.getReceivedRequests(userId);
      set({
        receivedRequests: response,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err) || 'Failed to fetch received requests',
        receivedRequests: null,
      });
    } finally {
      set({ loading: false });
    }
  },
  searchUsers: async (username: string) => {
    if (username.length < 3) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await searchUsersApi(username);
      const currentState = get();
      set({
        searchResults: results.map((user: UserDTO) => ({
          ...user,
          isFriend: currentState.friends?.userDetails?.some(f => f.userId === user.userId) || false,
          requestSent: currentState.pendingRequests?.userId === user.userId || false,
        })),
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) || 'Search failed' });
    }
  },

  fetchFriends: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await friendApi.getUsersByStatus(userId, 'ACCEPTED');
      set({
        friends: response,
        error: null,
      });

    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err) || 'Failed to fetch friends',
        friends: null,
      });
    } finally {
      set({ loading: false });
    }
  },

  fetchSentRequests: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await friendApi.getUsersByStatus(userId, 'PENDING');
      set({
        pendingRequests: response,
        error: null,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err) || 'Failed to fetch pending requests',
        pendingRequests: null,
      });
    } finally {
      set({ loading: false });
    }
  },

  handleAccept: async (userId: string, friendId: string) => {

    try {
      await friendApi.acceptFriendRequest(friendId, userId);
      set((state) => {
        if (!state.pendingRequests || !state.friends) {
          return {};
        }
        const acceptedRequest = state.pendingRequests.userDetails.find(f => f.userId === friendId);
        if (!acceptedRequest) {
          return {};
        }
        // Remove from pendingRequests.userDetails
        const updatedPendingRequests = {
          ...state.pendingRequests,
          userDetails: state.pendingRequests.userDetails.filter(f => f.userId !== friendId),
        };

        // Add to friends as User, ensuring required fields are present
        return {
          pendingRequests: updatedPendingRequests,
          friends: state.friends && state.friends.userId && state.friends.status
            ? {
              ...state.friends,
              userId: state.friends.userId,
              status: state.friends.status,
              userDetails: [...(state.friends.userDetails || []), acceptedRequest],
            }
            : state.friends,
        };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) || 'Failed to accept friend request' });
    }
  },

  handleReject: async (userId: string, friendId: string) => {
    try {

      await friendApi.rejectFriendRequest(friendId, userId);
      set((state) => {
        if (!state.pendingRequests) {
          return {};
        }
        const updatedFriends =
          state.friends && state.friends.userId && state.friends.status
            ? {
              ...state.friends,
              userId: state.friends.userId,
              status: state.friends.status,
              userDetails: state.friends.userDetails
                ? state.friends.userDetails.filter(f => f.userId !== friendId)
                : [],
            }
            : state.friends;
        return {
          pendingRequests: {
            ...state.pendingRequests,
            userDetails: state.pendingRequests.userDetails.filter(f => f.userId !== friendId),
          },
          friends: updatedFriends,
        };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) || 'Failed to reject friend request' });
    }
  },

  blockFriend: async (_userId: string, friendId: string) => {
    try {
      await friendApi.blockFriend(friendId);
      set((state) => {
        let updatedPendingRequests = state.pendingRequests;
        if (state.pendingRequests && Array.isArray(state.pendingRequests.userDetails)) {
          updatedPendingRequests = {
            ...state.pendingRequests,
            userDetails: state.pendingRequests.userDetails.filter(f => f.userId !== friendId),
          };
        }
        const newBlockedIds = new Set(state.blockedUserIds);
        newBlockedIds.add(friendId);
        return {
          friends: state.friends
            ? {
              ...state.friends,
              userId: state.friends.userId,
              status: state.friends.status,
              userDetails: state.friends.userDetails
                ? state.friends.userDetails.filter(f => f.userId !== friendId)
                : [],
            }
            : null,
          pendingRequests: updatedPendingRequests,
          blockedUserIds: newBlockedIds,
        };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) || 'Failed to block friend' });
    }
  },

  unblockFriend: async (_userId: string, friendId: string) => {
    try {
      await friendApi.unblockFriend(friendId);
      set((state) => {
        const newBlockedIds = new Set(state.blockedUserIds);
        newBlockedIds.delete(friendId);
        return { error: null, blockedUserIds: newBlockedIds };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) || 'Failed to unblock friend' });
    }
  },

  fetchBlockedUsers: async (userId: string) => {
    try {
      const response = await friendApi.getUsersByStatus(userId, 'BLOCKED');
      const blockedIds = new Set<string>(
        response?.userDetails?.map((u: { userId: string }) => u.userId) ?? []
      );
      set({ blockedUserIds: blockedIds });
    } catch (err) {
      logger.debug('Failed to fetch blocked users: ' + (err instanceof Error ? err.message : String(err)));
    }
  },

  reset: () => set(initialState),
}));

export const useFriends = () => useFriendStore(state => state.friends);
export const usePendingRequests = () => useFriendStore(state => state.pendingRequests);
export const useSearchResults = () => useFriendStore(state => state.searchResults);
export const useLoading = () => useFriendStore(state => state.loading);
export const useFetchFriends = () => useFriendStore(state => state.fetchFriends);
export const useFetchReceivedRequests = () => useFriendStore(state => state.fetchReceivedRequests);
export const useReceivedRequests = () => useFriendStore(state => state.receivedRequests);
export const useFetchSentRequests = () => useFriendStore(state => state.fetchSentRequests);