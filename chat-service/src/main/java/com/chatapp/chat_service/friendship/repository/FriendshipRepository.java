package com.chatapp.chat_service.friendship.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.friendship.entity.Friendship;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FriendshipRepository extends CassandraRepository<Friendship, Friendship.FriendshipKey> {

    @Query("SELECT * FROM friendships WHERE user_id = ?0 AND friend_id = ?1")
    Optional<Friendship> findByUserIdAndFriendId(UUID userId, UUID friendId);

    @Query("DELETE FROM friendships WHERE user_id = ?0 AND friend_id = ?1")
    void deleteByUserIdAndFriendId(UUID userId, UUID friendId);

    default boolean existsByUserIdAndFriendId(UUID userId, UUID friendId) {
        return findByUserIdAndFriendId(userId, friendId).isPresent();
    }
    @Query("SELECT * FROM accepted_friendships WHERE user_id = ?0")
    org.springframework.data.domain.Slice<Friendship> findAcceptedByUserId(
            UUID userId,
            org.springframework.data.domain.Pageable pageable
    );

    @Query("SELECT COUNT(*) FROM accepted_friendships WHERE user_id = ?0")
    long countAcceptedByUserId(UUID userId);

    @Query("SELECT * FROM pending_friend_requests WHERE friend_id = ?0")
    org.springframework.data.domain.Slice<Friendship> findReceivedFriendRequests(UUID friendId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT * FROM friendships WHERE user_id = ?0 AND status = 'PENDING' ALLOW FILTERING")
    org.springframework.data.domain.Slice<Friendship> findPendingFriendRequests(UUID userId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT * FROM blocked_relationships WHERE user_id = ?0")
    org.springframework.data.domain.Slice<Friendship> findBlockedFriendships(UUID userId, org.springframework.data.domain.Pageable pageable);

    default Optional<Friendship> findByUserAndFriend(UUID userId, UUID friendId) {
        return findByUserIdAndFriendId(userId, friendId);
    }

    default org.springframework.data.domain.Slice<Friendship> findByUserId(UUID userId, org.springframework.data.domain.Pageable pageable) {
        return findAcceptedByUserId(userId, pageable);
    }

    default List<UUID> findAcceptedFriendIds(UUID userId) {
        List<UUID> friendIds = new ArrayList<>();
        org.springframework.data.domain.Pageable pageable = org.springframework.data.cassandra.core.query.CassandraPageRequest.first(1000);
        
        org.springframework.data.domain.Slice<Friendship> sentSlice = findAcceptedByUserId(userId, pageable);
        for (Friendship friendship : sentSlice.getContent()) {
            friendIds.add(friendship.getFriendId());
        }
        
        return friendIds;
    }
}