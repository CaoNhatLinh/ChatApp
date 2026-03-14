package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.Ordering;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Table("message_revisions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageRevision {

    @PrimaryKey
    private MessageRevisionKey key;

    @Column("content")
    private String content;

    @Column("edited_at")
    private Instant editedAt;

    @Column("edited_by")
    private UUID editedBy;

    @Column("action")
    private String action;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @PrimaryKeyClass
    public static class MessageRevisionKey implements Serializable {
        @PrimaryKeyColumn(name = "conversation_id", type = PrimaryKeyType.PARTITIONED)
        private UUID conversationId;

        @PrimaryKeyColumn(name = "message_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
        private UUID messageId;

        @PrimaryKeyColumn(name = "revision_number", ordinal = 1, type = PrimaryKeyType.CLUSTERED, ordering = Ordering.DESCENDING)
        private Integer revisionNumber;
    }
}