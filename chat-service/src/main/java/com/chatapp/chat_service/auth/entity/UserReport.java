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

@Table("user_reports")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserReport {

    @PrimaryKey
    private UserReportKey key;

    @Column("reported_at")
    private Instant reportedAt;

    @Column("reason")
    private String reason;

    @Column("description")
    private String description;

    @Column("status")
    private String status; // PENDING, REVIEWED, RESOLVED, DISMISSED

    @Column("reviewed_by")
    private java.util.UUID reviewedBy;

    @Column("reviewed_at")
    private Instant reviewedAt;

    @Column("resolution_note")
    private String resolutionNote;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @PrimaryKeyClass
    public static class UserReportKey implements Serializable {
        @PrimaryKeyColumn(name = "report_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
        private java.util.UUID reportId;

        @PrimaryKeyColumn(name = "reported_user_id", ordinal = 1, type = PrimaryKeyType.CLUSTERED)
        private java.util.UUID reportedUserId;
    }
}
