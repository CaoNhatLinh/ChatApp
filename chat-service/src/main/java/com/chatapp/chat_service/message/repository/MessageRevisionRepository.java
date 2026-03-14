package com.chatapp.chat_service.message.repository;

import com.chatapp.chat_service.message.entity.MessageRevision;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRevisionRepository extends CassandraRepository<MessageRevision, MessageRevision.MessageRevisionKey> {

    @Query("SELECT * FROM message_revisions WHERE conversation_id = ?0 AND message_id = ?1")
    List<MessageRevision> findByConversationIdAndMessageId(UUID conversationId, UUID messageId);
}