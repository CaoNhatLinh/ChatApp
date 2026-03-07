package com.chatapp.chat_service.conversation.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.conversation.entity.Conversation;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends CassandraRepository<Conversation, UUID> {

    Optional<Conversation> findByConversationId(UUID id);

}
