package com.chatapp.chat_service.auth.repository;

import com.chatapp.chat_service.auth.entity.UserBlock;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserBlockRepository extends CassandraRepository<UserBlock, UserBlock.UserBlockKey> {

    @Query("SELECT * FROM user_blocks WHERE blocker_id = ?0")
    List<UserBlock> findByBlockerId(UUID blockerId);

    @Query("SELECT * FROM user_blocks WHERE blocker_id = ?0 AND blocked_user_id = ?1")
    UserBlock findByBlockerIdAndBlockedUserId(UUID blockerId, UUID blockedUserId);

    @Query("DELETE FROM user_blocks WHERE blocker_id = ?0 AND blocked_user_id = ?1")
    void deleteByBlockerIdAndBlockedUserId(UUID blockerId, UUID blockedUserId);
}
