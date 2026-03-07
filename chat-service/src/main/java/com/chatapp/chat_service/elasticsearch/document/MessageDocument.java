package com.chatapp.chat_service.elasticsearch.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Elasticsearch document for message search and filtering
 * Enables full-text search on content and filtering by sender, type, etc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "messages")
public class MessageDocument {
    
    @Id
    private String id; 
    
    @Field(type = FieldType.Keyword)
    private UUID conversationId;
    
    @Field(type = FieldType.Keyword)
    private UUID messageId;
    
    @Field(type = FieldType.Keyword)
    private UUID senderId;
    
    @Field(type = FieldType.Text)
    private String senderUsername;
    
    @Field(type = FieldType.Text)
    private String senderDisplayName;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String content;
    
    @Field(type = FieldType.Keyword)
    private String type; 
    
    @Field(type = FieldType.Date)
    private Instant createdAt;
    
    @Field(type = FieldType.Date)
    private Instant editedAt;
    
    @Field(type = FieldType.Boolean)
    private boolean isDeleted;
    
    @Field(type = FieldType.Keyword)
    private UUID replyTo;
    
    @Field(type = FieldType.Keyword)
    private List<UUID> mentionedUserIds;
    
    @Field(type = FieldType.Integer)
    private int reactionCount;
    
    @Field(type = FieldType.Boolean)
    private boolean hasAttachments;
}
