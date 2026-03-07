package com.chatapp.chat_service.conversation.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.Ordering;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Table("user_conversations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserConversation {

    @org.springframework.data.cassandra.core.mapping.PrimaryKey
    private UserConversationKey key;

    @Column("joined_at")
    private Instant joinedAt;

    @Column("role")
    private String role;

    @PrimaryKeyClass
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserConversationKey implements Serializable {

        @PrimaryKeyColumn(name = "user_id", type = PrimaryKeyType.PARTITIONED)
        private UUID userId;

        @PrimaryKeyColumn(name = "is_pinned", ordinal = 0, type = PrimaryKeyType.CLUSTERED, ordering = Ordering.DESCENDING)
        private boolean isPinned;

        @PrimaryKeyColumn(name = "last_activity_at", ordinal = 1, type = PrimaryKeyType.CLUSTERED, ordering = Ordering.DESCENDING)
        private Instant lastActivityAt;

        @PrimaryKeyColumn(name = "conversation_id", ordinal = 2, type = PrimaryKeyType.CLUSTERED, ordering = Ordering.ASCENDING)
        private UUID conversationId;
    }
}
