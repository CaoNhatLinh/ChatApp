package com.chatapp.chat_service.message.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.message.entity.MessageReadReceipt;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageReadReceiptRepository extends CassandraRepository<MessageReadReceipt, MessageReadReceipt.MessageReadReceiptKey> {

    @Query("SELECT * FROM message_read_receipts WHERE conversation_id = ?0 AND message_id = ?1")
    List<MessageReadReceipt> findByConversationIdAndMessageId(UUID conversationId, UUID messageId);

    @Query("SELECT * FROM message_read_receipts WHERE conversation_id = ?0 AND reader_id = ?1")
    List<MessageReadReceipt> findByConversationIdAndReaderId(UUID conversationId, UUID readerId);

    @Query("SELECT COUNT(*) FROM message_read_receipts WHERE conversation_id = ?0 AND message_id = ?1")
    long countByConversationIdAndMessageId(UUID conversationId, UUID messageId);
}
