package com.chatapp.chat_service.message.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.message.entity.MessageAttachment;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageAttachmentRepository extends CassandraRepository<MessageAttachment, MessageAttachment.MessageAttachmentKey> {

    @Query("SELECT * FROM message_attachments WHERE conversation_id = ?0 AND message_id = ?1")
    List<MessageAttachment> findByConversationIdAndMessageId(UUID conversationId, UUID messageId);

    @Query("SELECT * FROM message_attachments WHERE conversation_id = ?0")
    List<MessageAttachment> findByConversationId(UUID conversationId);

    @Query("DELETE FROM message_attachments WHERE conversation_id = ?0 AND message_id = ?1")
    void deleteByConversationIdAndMessageId(UUID conversationId, UUID messageId);

    @Query("SELECT * FROM message_attachments WHERE conversation_id = ?0 AND message_id IN ?1")
    List<MessageAttachment> findByConversationIdAndMessageIdIn(UUID conversationId, List<UUID> messageIds);
}
