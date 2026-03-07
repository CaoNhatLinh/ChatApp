package com.chatapp.chat_service.conversation.entity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import com.chatapp.chat_service.message.dto.MessageSummary;

import java.time.Instant;
import java.util.UUID;
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("conversations")
public class Conversation {
    @PrimaryKey("conversation_id")
    private UUID conversationId;
    
    private String type; 
    private String name;
    private String description;
    
    @Column("is_deleted")
    private boolean isDeleted;
    
    @Column("last_message")
    private MessageSummary lastMessage;
    
    @Column("created_by")
    private UUID createdBy;
    
    @Column("background_url")
    private String backgroundUrl;
    
    @Column("created_at")
    private Instant createdAt;
    
    @Column("updated_at")
    private Instant updatedAt;
}
