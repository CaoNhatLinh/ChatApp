
import { useEffect, useMemo } from 'react';
import { FriendItem } from './FriendItem';
import { useFetchFriends, useFriendStore } from '@/features/relationships/model/friend.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useTrackPresence } from '@/features/presence/hooks/useTrackPresence';

export const FriendList = () => {
  const { friends } = useFriendStore();
  const fetchFriends = useFetchFriends();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.userId) return;
    void fetchFriends();
  }, [fetchFriends, user?.userId]);

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