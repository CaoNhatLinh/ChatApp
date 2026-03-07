package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;

@Table("pinned_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PinnedMessage {

    @PrimaryKey
    private PinnedMessageKey key;

    @Column("pinned_at")
    private Instant pinnedAt;

    @Column("pinned_by")
    private java.util.UUID pinnedBy;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PinnedMessageKey {
        @Column("conversation_id")
        private java.util.UUID conversationId;

        @Column("message_id")
        private java.util.UUID messageId;
    }
}
