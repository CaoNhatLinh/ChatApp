package com.chatapp.chat_service.canonical.search;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.DateFormat;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;
import java.util.Set;

@Document(indexName = "${app.elasticsearch.message-index}")
public class MessageSearchDocument {
    @Id private String id;
    @Field(type = FieldType.Keyword) private String messageId;
    @Field(type = FieldType.Keyword) private String conversationId;
    @Field(type = FieldType.Keyword) private String messageBucket;
    @Field(type = FieldType.Keyword) private String senderId;
    @Field(type = FieldType.Keyword) private String replyToSenderId;
    @Field(type = FieldType.Keyword) private Set<String> mentionedUserIds;
    @Field(type = FieldType.Keyword) private String messageType;
    @Field(type = FieldType.Text) private String content;
    @Field(type = FieldType.Boolean) private boolean hasAttachments;
    @Field(type = FieldType.Boolean) private boolean isPinned;
    @Field(type = FieldType.Boolean) private boolean isDeleted;
    @Field(type = FieldType.Date, format = DateFormat.date_time) private Instant createdAt;

    public MessageSearchDocument() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getMessageBucket() { return messageBucket; }
    public void setMessageBucket(String messageBucket) { this.messageBucket = messageBucket; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public String getReplyToSenderId() { return replyToSenderId; }
    public void setReplyToSenderId(String replyToSenderId) { this.replyToSenderId = replyToSenderId; }
    public Set<String> getMentionedUserIds() { return mentionedUserIds; }
    public void setMentionedUserIds(Set<String> mentionedUserIds) { this.mentionedUserIds = mentionedUserIds; }
    public String getMessageType() { return messageType; }
    public void setMessageType(String messageType) { this.messageType = messageType; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public boolean isHasAttachments() { return hasAttachments; }
    public void setHasAttachments(boolean hasAttachments) { this.hasAttachments = hasAttachments; }
    public boolean isPinned() { return isPinned; }
    public void setPinned(boolean pinned) { isPinned = pinned; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
