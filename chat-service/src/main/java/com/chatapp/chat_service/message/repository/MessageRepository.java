package com.chatapp.chat_service.message.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.message.entity.Message;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MessageRepository extends CassandraRepository<Message, Message.MessageKey> {

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 ORDER BY message_id DESC LIMIT ?1")
    List<Message> findByConversationIdWithLimit(UUID conversationId, int limit);

    List<Message> findByKeyConversationIdOrderByKeyMessageIdDesc(UUID conversationId, Pageable pageable);

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND message_id < ?1 ORDER BY message_id DESC LIMIT 30")
    List<Message> findOlderMessages(UUID conversationId, UUID beforeMessageId);

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND message_id = ?1")
    Optional<Message> findByConversationIdAndMessageId(UUID conversationId, UUID messageId);

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND message_id < ?1 ORDER BY message_id DESC LIMIT ?2")
    List<Message> findByConversationIdBeforeMessageId(UUID conversationId, UUID beforeMessageId, int limit);

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND message_id > ?1 ORDER BY message_id DESC LIMIT ?2")
    List<Message> findByConversationIdAfterMessageId(UUID conversationId, UUID afterMessageId, int limit);

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND message_id > ?1 AND message_id < ?2 ORDER BY message_id DESC LIMIT ?3")
    List<Message> findByConversationIdBetweenMessageIds(UUID conversationId, UUID afterMessageId, UUID beforeMessageId, int limit);

    @Query("SELECT * FROM messages_by_conversation WHERE conversation_id = ?0 AND message_id IN ?1")
    List<Message> findByConversationIdAndMessageIdIn(UUID conversationId, List<UUID> messageIds);
}