package com.chatapp.chat_service.elasticsearch.document;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;
import java.util.UUID;

@Document(indexName = "notifications")
public class NotificationDocument {
    
    @Id
    private String id;
    
    @Field(type = FieldType.Keyword)
    private UUID notificationId;
    
    @Field(type = FieldType.Keyword)
    private UUID userId;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String title;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String body;
    
    @Field(type = FieldType.Keyword)
    private String type; 
    
    @Field(type = FieldType.Text)
    private String metadata; 
    
    @Field(type = FieldType.Boolean)
    private Boolean isRead;
    
    @Field(type = FieldType.Date)
    private Instant createdAt;
    
    public NotificationDocument() {}

    public NotificationDocument(String id, UUID notificationId, UUID userId, String title, String body, String type, String metadata, Boolean isRead, Instant createdAt) {
        this.id = id;
        this.notificationId = notificationId;
        this.userId = userId;
        this.title = title;
        this.body = body;
        this.type = type;
        this.metadata = metadata;
        this.isRead = isRead;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public UUID getNotificationId() { return notificationId; }
    public void setNotificationId(UUID notificationId) { this.notificationId = notificationId; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
