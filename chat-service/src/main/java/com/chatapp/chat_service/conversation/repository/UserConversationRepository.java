package com.chatapp.chat_service.conversation.repository;

import com.chatapp.chat_service.conversation.entity.UserConversation;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserConversationRepository extends CassandraRepository<UserConversation, UserConversation.UserConversationKey> {

    @Query("SELECT * FROM user_conversations WHERE user_id = ?0")
    org.springframework.data.domain.Slice<UserConversation> findByUserId(UUID userId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT * FROM user_conversations WHERE user_id = ?0 AND conversation_id = ?1")
    Optional<UserConversation> findByUserIdAndConversationId(UUID userId, UUID conversationId);
    
    @Query("SELECT * FROM user_conversations WHERE conversation_id = ?0")
    List<UserConversation> findByConversationId(UUID conversationId);

    void deleteByKeyUserIdAndKeyConversationId(UUID userId, UUID conversationId);
}
