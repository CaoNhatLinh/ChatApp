
import { useEffect, useMemo } from 'react';
import { FriendItem } from './FriendItem';
import { useFetchFriends, useFriendStore } from '@/store/friendStore';
import { useAuthStore } from '@/store/authStore';
import { useTrackPresence } from '@/hooks/presence/useTrackPresence';

export const FriendList = () => {
  const { friends } = useFriendStore();
  const fetchFriends = useFetchFriends();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.userId) return;
    void fetchFriends(user.userId);
  }, [fetchFriends, user?.userId]);

  // Track presence for all friends currently in the list
  const friendIds = useMemo(() =>
    friends?.userDetails?.map(f => f.userId) ?? [],
    [friends?.userDetails]
  );
  useTrackPresence(friendIds);

  return (
    <div>
      {friends?.userDetails.length === 0 && (
        <div className="text-gray-500">Bạn chưa có bạn bè nào.</div>
      )}

      {friends?.userDetails.map(friend => (
        <FriendItem
          key={friend.userId}
          friend={friend}
        />
      ))}
    </div>
  );
};