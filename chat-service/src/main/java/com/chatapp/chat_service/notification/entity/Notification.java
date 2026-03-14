package com.chatapp.chat_service.notification.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.Ordering;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @PrimaryKeyColumn(name = "user_id", type = PrimaryKeyType.PARTITIONED)
    private UUID userId;

    @PrimaryKeyColumn(name = "notification_id", type = PrimaryKeyType.CLUSTERED, ordering = Ordering.DESCENDING)
    private UUID notificationId;

    @Column("title")
    private String title;

    @Column("body")
    private String body;

    @Column("type")
    private String type; 

    @Column("metadata")
    private String metadata; 

    @Column("is_read")
    private Boolean isRead;

    @Column("created_at")
    private Instant createdAt;

    public static class NotificationType {
        public static final String MESSAGE = "MESSAGE";
        public static final String MENTION = "MENTION";
        public static final String REPLY = "REPLY";
        public static final String REACTION = "REACTION";
        public static final String FRIEND_REQUEST = "FRIEND_REQUEST";
        public static final String CONVERSATION_INVITE = "CONVERSATION_INVITE";
        public static final String SYSTEM = "SYSTEM";
        public static final String POLL = "POLL";
        public static final String PIN_MESSAGE = "PIN_MESSAGE";
    }
}