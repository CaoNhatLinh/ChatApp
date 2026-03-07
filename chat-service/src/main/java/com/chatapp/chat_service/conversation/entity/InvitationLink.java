package com.chatapp.chat_service.conversation.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity cho quản lý lời mời vào conversation (group/channel)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("invitation_links")
public class InvitationLink {
    @PrimaryKey("link_id")
    private UUID linkId;
    
    private UUID conversationId;
    private String linkToken; 
    private UUID createdBy; 
    private Instant createdAt;
    private Instant expiresAt; 
    private boolean isActive; 
    private Integer maxUses; 
    private Integer usedCount; 
}
