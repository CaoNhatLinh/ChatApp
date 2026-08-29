import { create } from 'zustand';
import { friendApi } from '@/features/relationships/api/friends.api';
import { searchUsers as searchUsersApi } from '@/features/profile/api/users.api';
import { logger } from '@/shared/lib/logger';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { FRIEND_COPY } from '@/features/relationships/constants/friends.constants';
import type { FriendDetails } from '@/features/relationships/model/friend.types';
import type { UserDTO } from '@/entities/user/model/user.types';

interface FriendStoreState {
  friends: FriendDetails | null;

  pendingRequests: FriendDetails | null;
  receivedRequests: FriendDetails | null;
  mutualFriends: FriendDetails | null;
  loadingFriends: boolean;
  loadingReceived: boolean;
  loadingSent: boolean;
  loadingSearch: boolean;
  loadingMutual: boolean;
  error: string | null;
  searchResults: (UserDTO & { isFriend?: boolean; requestSent?: boolean })[];
  blockedUserIds: Set<string>;
}

interface FriendStoreActions {
  searchUsers: (username: string) => Promise<void>;
  fetchFriends: () => Promise<void>;
  fetchSentRequests: () => Promise<void>;
  fetchReceivedRequests: () => Promise<void>;
  fetchMutualFriends: (otherUserId: string) => Promise<void>;
  handleAccept: (friendId: string) => Promise<void>;
  handleReject: (friendId: string) => Promise<void>;
  blockFriend: (friendId: string) => Promise<void>;
  unblockFriend: (friendId: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<void>;
  fetchBlockedUsers: () => Promise<void>;
  unfriend: (friendId: string) => Promise<void>;
  getIsFriend: (userId: string) => boolean;
  reset: () => void;
}

const createInitialState = (): FriendStoreState => ({
  friends: null,
  pendingRequests: null,
  receivedRequests: null,
  mutualFriends: null,
  loadingFriends: false,
  loadingReceived: false,
  loadingSent: false,
  loadingSearch: false,
  loadingMutual: false,
  error: null,
  searchResults: [],
  blockedUserIds: new Set<string>(),
});

const initialState = createInitialState();

let searchAbortController: AbortController | null = null;
let mutualAbortController: AbortController | null = null;

export const useFriendStore = create<FriendStoreState & FriendStoreActions>((set, get) => ({
  ...initialState,

  sendFriendRequest: async (friendId: string) => {
    set({ loadingSent: true, error: null });
    try {
      await friendApi.sendRequest(friendId);
      const pendingRequests = await friendApi.getUsersByStatus('PENDING');
      set((state) => {
        return {
          pendingRequests,
          searchResults: state.searchResults.map((candidate) => (
            candidate.userId === friendId
              ? { ...candidate, isFriend: false, requestSent: true }
              : candidate
          )),
          error: null,
        };
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, FRIEND_COPY.actions.sentFailed);
      set({ error: errorMessage });
      logger.error('Error sending friend request:', { error: err, friendId });
    } finally {
      set({ loadingSent: false });
    }
  },
  fetchReceivedRequests: async () => {
    logger.debug('Fetching received requests for current user');
    set({ loadingReceived: true, error: null });
    try {
      const response = await friendApi.getReceivedRequests();
      set({
        receivedRequests: response,
        error: null,
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể tải lời mời kết bạn.');
      set({
        error: errorMessage,
        receivedRequests: null,
      });
      logger.error('Error fetching received requests:', { error: err });
    } finally {
      set({ loadingReceived: false });
    }
  },
  searchUsers: async (username: string) => {
    if (username.length < 3) {
      set({
        searchResults: [],
        loadingSearch: false,
      });
      return;
    }

    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    set({ loadingSearch: true, error: null });

    try {
      const results = await searchUsersApi(username);
      const currentState = get();
      const acceptedFriendIds = new Set(currentState.friends?.userDetails?.map(friend => friend.userId) ?? []);
      const pendingFriendIds = new Set(currentState.pendingRequests?.userDetails?.map(friend => friend.userId) ?? []);

      set({
        searchResults: results.map((user: UserDTO) => ({
          ...user,
          isFriend: acceptedFriendIds.has(user.userId),
          requestSent: pendingFriendIds.has(user.userId),
        })),
        error: null,
      });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể tải người dùng.');
      set({ error: errorMessage });
      logger.error('Error searching users:', { error: err, username });
    } finally {
      set({ loadingSearch: false });
    }
  },

  fetchFriends: async () => {
    set({ loadingFriends: true, error: null });
    try {
      const response = await friendApi.getUsersByStatus('ACCEPTED');
      set({
        friends: response,
        error: null,
      });

    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể tải danh sách bạn bè.');
      set({
        error: errorMessage,
        friends: null,
      });
      logger.error('Error fetching friends:', { error: err });
    } finally {
      set({ loadingFriends: false });
    }
  },

  fetchSentRequests: async () => {
    set({ loadingSent: true, error: null });
    try {
      const response = await friendApi.getUsersByStatus('PENDING');
      set({
        pendingRequests: response,
        error: null,
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể tải lời mời đã gửi.');
      set({
        error: errorMessage,
        pendingRequests: null,
      });
      logger.error('Error fetching sent requests:', { error: err });
    } finally {
      set({ loadingSent: false });
    }
  },

  handleAccept: async (friendId: string) => {

    try {
      await friendApi.acceptFriendRequest(friendId);
      set((state) => {
        if (!state.receivedRequests || !state.friends) {
          return {};
        }
        const acceptedUser = state.receivedRequests.userDetails.find(f => f.userId === friendId);
        if (!acceptedUser) {
          return {};
        }

        return {
          receivedRequests: {
            ...state.receivedRequests,
            userDetails: state.receivedRequests.userDetails.filter(f => f.userId !== friendId),
          },
          friends: {
            ...state.friends,
            userDetails: [...state.friends.userDetails, acceptedUser],
          },
        };
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, FRIEND_COPY.actions.acceptFailed);
      set({ error: errorMessage });
      logger.error('Error accepting friend request:', { error: err, friendId });
    }
  },

  handleReject: async (friendId: string) => {
    try {
      await friendApi.rejectFriendRequest(friendId);
      set((state) => {
        if (!state.receivedRequests) {
          return {};
        }
        return {
          receivedRequests: {
            ...state.receivedRequests,
            userDetails: state.receivedRequests.userDetails.filter(f => f.userId !== friendId),
          },
        };
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, FRIEND_COPY.actions.rejectFailed);
      set({ error: errorMessage });
      logger.error('Error rejecting friend request:', { error: err, friendId });
    }
  },

  unfriend: async (friendId: string) => {
    try {
      await friendApi.unfriend(friendId);
      set((state) => ({
        friends: state.friends
          ? {
            ...state.friends,
            userDetails: state.friends.userDetails.filter(f => f.userId !== friendId),
          }
          : null,
      }));
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, FRIEND_COPY.actions.unfriendFailed);
      set({ error: errorMessage });
      logger.error('Error unfriending:', { error: err, friendId });
    }
  },

  blockFriend: async (friendId: string) => {
    try {
      await friendApi.blockFriend(friendId);
      set((state) => {
        const newBlockedIds = new Set(state.blockedUserIds);
        newBlockedIds.add(friendId);

        return {
          friends: state.friends
            ? {
              ...state.friends,
              userDetails: state.friends.userDetails
                ? state.friends.userDetails.filter(f => f.userId !== friendId)
                : [],
            }
            : null,
          receivedRequests: state.receivedRequests
            ? {
              ...state.receivedRequests,
              userDetails: state.receivedRequests.userDetails.filter(f => f.userId !== friendId),
            }
            : null,
          pendingRequests: state.pendingRequests
            ? {
              ...state.pendingRequests,
              userDetails: state.pendingRequests.userDetails.filter(f => f.userId !== friendId),
            }
            : null,
          blockedUserIds: newBlockedIds,
        };
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể chặn người dùng.');
      set({ error: errorMessage });
      logger.error('Error blocking user:', { error: err, friendId });
    }
  },

  unblockFriend: async (friendId: string) => {
    try {
      await friendApi.unblockFriend(friendId);
      set((state) => {
        const newBlockedIds = new Set(state.blockedUserIds);
        newBlockedIds.delete(friendId);
        return { error: null, blockedUserIds: newBlockedIds };
      });
    } catch (err: unknown) {
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể bỏ chặn người dùng.');
      set({ error: errorMessage });
      logger.error('Error unblocking user:', { error: err, friendId });
    }
  },

  fetchBlockedUsers: async () => {
    try {
      const response = await friendApi.getUsersByStatus('BLOCKED');
      const blockedIds = new Set<string>(
        response.userDetails.map((u: { userId: string }) => u.userId)
      );
      set({ blockedUserIds: blockedIds });
    } catch (err) {
      logger.debug('Failed to fetch blocked users: ' + (err instanceof Error ? err.message : String(err)));
    }
  },

  fetchMutualFriends: async (otherUserId: string) => {
    if (mutualAbortController) mutualAbortController.abort();
    mutualAbortController = new AbortController();

    set({ loadingMutual: true, error: null });
    try {
      const response = await friendApi.getMutualFriends(otherUserId);
      set({
        mutualFriends: {
          userId: otherUserId,
          status: 'ACCEPTED',
          userDetails: response,
        },
        error: null,
      });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      const errorMessage = getUserFacingErrorMessage(err, 'Không thể tải bạn chung.');
      set({ error: errorMessage });
      logger.error('Error fetching mutual friends:', { error: err, otherUserId });
    } finally {
      set({ loadingMutual: false });
    }
  },

  getIsFriend: (userId: string) => {
    const friendList = get().friends?.userDetails ?? [];
    return friendList.some(f => f.userId === userId);
  },

  reset: () => set(() => createInitialState()),
}));

export const useFriends = () => useFriendStore(state => state.friends);
export const usePendingRequests = () => useFriendStore(state => state.pendingRequests);
export const useSearchResults = () => useFriendStore(state => state.searchResults);
export const useLoadingFriends = () => useFriendStore(state => state.loadingFriends);
export const useLoadingReceived = () => useFriendStore(state => state.loadingReceived);
export const useLoadingSent = () => useFriendStore(state => state.loadingSent);
export const useLoadingSearch = () => useFriendStore(state => state.loadingSearch);
export const useFetchFriends = () => useFriendStore(state => state.fetchFriends);
export const useFetchReceivedRequests = () => useFriendStore(state => state.fetchReceivedRequests);
export const useReceivedRequests = () => useFriendStore(state => state.receivedRequests);
export const useFetchSentRequests = () => useFriendStore(state => state.fetchSentRequests);
