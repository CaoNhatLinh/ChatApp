package com.chatapp.chat_service.elasticsearch.document;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import com.chatapp.chat_service.message.dto.MessageSummary;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "conversations")
public class ConversationDocument {
    
    @Id
    private String id;
    
    @Field(type = FieldType.Keyword)
    private UUID conversationId;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String name;
    
    @Field(type = FieldType.Keyword)
    private String type; 
    
    @Field(type = FieldType.Boolean)
    private boolean isDeleted;
    
    @Field(type = FieldType.Date)
    private Instant createdAt;
    
    @Field(type = FieldType.Date)
    private Instant updatedAt;
    
    @Field(type = FieldType.Object)
    private MessageSummary lastMessage;
    
    @Field(type = FieldType.Keyword)
    private UUID createdBy;
    
    @Field(type = FieldType.Text)
    private String description;
    
    @Field(type = FieldType.Text)
    private String avatar;
    
    @Field(type = FieldType.Keyword)
    private List<UUID> memberIds;
    
    @Field(type = FieldType.Integer)
    private int memberCount;
}
