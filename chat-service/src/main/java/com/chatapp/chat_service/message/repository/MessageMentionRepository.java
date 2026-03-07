package com.chatapp.chat_service.message.repository;

import com.chatapp.chat_service.message.entity.MessageMention;
import com.chatapp.chat_service.message.entity.MessageMention.MessageMentionKey;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageMentionRepository extends CassandraRepository<MessageMention, MessageMentionKey> {
    
    /**
     * Find all mentions for a specific message
     */
    List<MessageMention> findByKeyConversationIdAndKeyMessageId(UUID conversationId, UUID messageId);
    
    /**
     * Delete all mentions for a message (when message is deleted)
     */
    void deleteByKeyConversationIdAndKeyMessageId(UUID conversationId, UUID messageId);

    /**
     * Find mentions for multiple messages in a conversation
     */
    List<MessageMention> findByKeyConversationIdAndKeyMessageIdIn(UUID conversationId, List<UUID> messageIds);
}
