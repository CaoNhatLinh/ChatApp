package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Table("message_forwards")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageForward {

    @PrimaryKey
    private MessageForwardKey key;

    @Column("forwarded_at")
    private Instant forwardedAt;

    @Column("forwarded_by")
    private UUID forwardedBy;

    @Column("original_conversation_id")
    private UUID originalConversationId;

    @Column("original_sender_id")
    private UUID originalSenderId;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @PrimaryKeyClass
    public static class MessageForwardKey implements Serializable {
        @Column("conversation_id")
        private UUID conversationId;

        @Column("message_id")
        private UUID messageId;
    }
}
