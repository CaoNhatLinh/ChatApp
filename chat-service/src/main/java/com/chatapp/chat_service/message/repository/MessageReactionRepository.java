package com.chatapp.chat_service.message.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.message.entity.MessageReaction;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageReactionRepository extends CassandraRepository<MessageReaction, MessageReaction.MessageReactionKey> {

    @Query("SELECT * FROM message_reactions WHERE conversation_id = ?0 AND message_id = ?1")
    List<MessageReaction> findByConversationIdAndMessageId(UUID conversationId, UUID messageId);

    @Query("SELECT * FROM message_reactions WHERE conversation_id = ?0 AND message_id = ?1 AND user_id = ?2")
    List<MessageReaction> findByConversationIdAndMessageIdAndUserId(UUID conversationId, UUID messageId, UUID userId);

    @Query("SELECT * FROM message_reactions WHERE conversation_id = ?0 AND message_id = ?1 AND emoji = ?2")
    List<MessageReaction> findByConversationIdAndMessageIdAndEmoji(UUID conversationId, UUID messageId, String emoji);

    @Query("DELETE FROM message_reactions WHERE conversation_id = ?0 AND message_id = ?1 AND emoji = ?2 AND user_id = ?3")
    void deleteByConversationIdAndMessageIdAndEmojiAndUserId(UUID conversationId, UUID messageId, String emoji, UUID userId);

    @Query("SELECT * FROM message_reactions WHERE conversation_id = ?0 AND message_id IN ?1")
    List<MessageReaction> findByConversationIdAndMessageIdIn(UUID conversationId, List<UUID> messageIds);
}
