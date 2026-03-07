package com.chatapp.chat_service.conversation.repository;

import org.springframework.data.cassandra.repository.AllowFiltering;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.conversation.entity.ConversationMembers;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
public interface ConversationMemberRepository extends CassandraRepository<ConversationMembers, ConversationMembers.ConversationMemberKey> {

    @Query("SELECT * FROM user_conversation_members WHERE user_id = ?0")
    org.springframework.data.domain.Slice<ConversationMembers> findByKeyUserId(UUID userId, org.springframework.data.domain.Pageable pageable);
    
    @AllowFiltering  
    org.springframework.data.domain.Slice<ConversationMembers> findByKeyConversationId(UUID conversationId, org.springframework.data.domain.Pageable pageable);
    
    @Query("SELECT * FROM conversation_members WHERE conversation_id = ?0")
    List<ConversationMembers> findAllByKeyConversationId(UUID conversationId);
    
    @Query("SELECT COUNT(*) FROM conversation_members WHERE conversation_id = ?0")
    long countByKeyConversationId(UUID conversationId);
    
    boolean existsByKeyConversationIdAndKeyUserId(UUID conversationId, UUID userId);

    @Query("SELECT * FROM user_conversation_members WHERE user_id = :userId")
    List<ConversationMembers> findByUserId(@Param("userId") UUID userId);
    
    default List<UUID> findConversationIdsByUserId(UUID userId) {
        return findByUserId(userId).stream()
            .map(member -> member.getKey().getConversationId())
            .collect(Collectors.toList());
    }
    
    default List<ConversationMembers> findByConversationId(UUID conversationId) {
        return findAllByKeyConversationId(conversationId);
    }
}
