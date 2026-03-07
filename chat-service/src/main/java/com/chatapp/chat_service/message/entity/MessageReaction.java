package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.io.Serializable;
import java.time.Instant;

@Table("message_reactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReaction {

    @PrimaryKey
    private MessageReactionKey key;

    @Column("reacted_at")
    private Instant reactedAt;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @PrimaryKeyClass
    public static class MessageReactionKey implements Serializable {
        @PrimaryKeyColumn(name = "conversation_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
        private java.util.UUID conversationId;

        @PrimaryKeyColumn(name = "message_id", ordinal = 1, type = PrimaryKeyType.CLUSTERED)
        private java.util.UUID messageId;

        @PrimaryKeyColumn(name = "emoji", ordinal = 2, type = PrimaryKeyType.CLUSTERED)
        private String emoji; 

        @PrimaryKeyColumn(name = "user_id", ordinal = 3, type = PrimaryKeyType.CLUSTERED)
        private java.util.UUID userId;
    }
}
