package com.chatapp.chat_service.conversation.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.conversation.entity.InvitationLink;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InvitationLinkRepository extends CassandraRepository<InvitationLink, UUID> {

    @Query("SELECT * FROM invitation_links WHERE link_token = ?0")
    Optional<InvitationLink> findByLinkToken(String linkToken);

    @Query("SELECT * FROM invitation_links WHERE conversation_id = ?0")
    List<InvitationLink> findByConversationId(UUID conversationId);

    @Query("SELECT * FROM invitation_links WHERE conversation_id = ?0 AND is_active = true")
    List<InvitationLink> findActiveByConversationId(UUID conversationId);

    @Query("SELECT * FROM invitation_links WHERE conversation_id = ?0 AND created_by = ?1")
    List<InvitationLink> findByConversationIdAndCreatedBy(UUID conversationId, UUID createdBy);

    @Query("SELECT * FROM invitation_links WHERE conversation_id = ?0 AND is_active = true AND expires_at > ?1")
    List<InvitationLink> findValidLinksByConversationId(UUID conversationId, Instant now);

    /**
     * Lightweight Transaction (LWT) to atomically increment usedCount if link is still valid
     * Returns true if the update was successful, false if the condition failed
     */
    @Query("UPDATE invitation_links " +
           "SET used_count = used_count + 1, " +
           "is_active = CASE WHEN (max_uses IS NOT NULL AND used_count + 1 >= max_uses) THEN false ELSE is_active END " +
           "WHERE link_id = ?0 " +
           "IF is_active = true AND expires_at > ?3 AND (max_uses IS NULL OR used_count < max_uses)")
    boolean incrementUsedCountIfValid(UUID linkId, Integer currentUsedCount, Integer maxUses, Instant now);
}
