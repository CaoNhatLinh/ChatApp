package com.chatapp.chat_service.auth.repository;

import org.springframework.data.cassandra.repository.AllowFiltering;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.auth.entity.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends CassandraRepository<User, UUID> {
    @AllowFiltering
    Optional<User> findFirstByUsername(String username);

    @Query("SELECT * FROM users WHERE user_id IN ?0")
    List<User> findUsersByIds(List<UUID> userIds);
    
    @Query("SELECT * FROM users WHERE user_id IN ?0")
    List<User> findByUserIdIn(List<UUID> userIds);
    
    @AllowFiltering
    Boolean existsByUsername(String username);
}
