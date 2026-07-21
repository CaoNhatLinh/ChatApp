package com.chatapp.chat_service.message.repository;

import com.chatapp.chat_service.message.entity.MessageForward;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageForwardRepository extends CassandraRepository<MessageForward, MessageForward.MessageForwardKey> {

    @Query("SELECT * FROM message_forwards WHERE conversation_id = ?0")
    List<MessageForward> findByConversationId(UUID conversationId);

    @Query("SELECT * FROM message_forwards WHERE conversation_id = ?0 AND message_id = ?1")
    List<MessageForward> findByConversationIdAndMessageId(UUID conversationId, UUID messageId);

    @Query("SELECT * FROM message_forwards WHERE forwarded_by = ?0")
    List<MessageForward> findByForwardedBy(UUID forwardedBy);

    @Query("DELETE FROM message_forwards WHERE conversation_id = ?0 AND message_id = ?1")
    void deleteByConversationIdAndMessageId(UUID conversationId, UUID messageId);
}
