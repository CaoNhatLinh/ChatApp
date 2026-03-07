package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

@Table("message_attachments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageAttachment {

    @PrimaryKey
    private MessageAttachmentKey key;

    @Column("attachment_type")
    private String attachmentType; 

    @Column("file_name")
    private String fileName;

    @Column("url")
    private String url;

    @Column("file_size")
    private Long fileSize;

    @Column("mime_type")
    private String mimeType;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MessageAttachmentKey {
        @Column("conversation_id")
        private java.util.UUID conversationId;

        @Column("message_id")
        private java.util.UUID messageId;

        @Column("attachment_id")
        private java.util.UUID attachmentId;
    }
}
