package com.chatapp.chat_service.auth.entity;

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

@Table("user_blocks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBlock {

    @PrimaryKey
    private UserBlockKey key;

    @Column("blocked_at")
    private Instant blockedAt;

    @Column("reason")
    private String reason;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @PrimaryKeyClass
    public static class UserBlockKey implements Serializable {
        @PrimaryKeyColumn(name = "blocker_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
        private java.util.UUID blockerId;

        @PrimaryKeyColumn(name = "blocked_user_id", ordinal = 1, type = PrimaryKeyType.CLUSTERED)
        private java.util.UUID blockedUserId;
    }
}
