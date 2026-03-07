package com.chatapp.chat_service.message.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.util.UUID;

/**
 * Entity for message_mentions table - stores user mentions separately
 * to avoid complex writes on large lists
 */
@Table("message_mentions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageMention {

    @PrimaryKey
    private MessageMentionKey key;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @PrimaryKeyClass
    public static class MessageMentionKey {
        @PrimaryKeyColumn(name = "conversation_id", type = PrimaryKeyType.PARTITIONED, ordinal = 0)
        private UUID conversationId;

        @PrimaryKeyColumn(name = "message_id", type = PrimaryKeyType.PARTITIONED, ordinal = 1)
        private UUID messageId;

        @PrimaryKeyColumn(name = "mentioned_user_id", type = PrimaryKeyType.CLUSTERED)
        private UUID mentionedUserId;
    }
}
