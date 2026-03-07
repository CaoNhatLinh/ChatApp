package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;

@Table("message_read_receipts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReadReceipt {

    @PrimaryKey
    private MessageReadReceiptKey key;

    @Column("read_at")
    private Instant readAt;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MessageReadReceiptKey {
        @Column("conversation_id")
        private java.util.UUID conversationId;

        @Column("message_id")
        private java.util.UUID messageId;

        @Column("reader_id")
        private java.util.UUID readerId;
    }
}
