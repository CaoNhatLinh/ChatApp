package com.chatapp.chat_service.common.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("audit_logs")
public class AuditLog {

    @PrimaryKey
    private UUID id;

    @Column("user_id")
    private UUID userId;

    @Column("username")
    private String username;

    @Column("action")
    private String action;

    @Column("resource_type")
    private String resourceType;

    @Column("resource_id")
    private String resourceId;

    @Column("details")
    private String details;

    @Column("ip_address")
    private String ipAddress;

    @Column("user_agent")
    private String userAgent;

    @Column("timestamp")
    private Instant timestamp;

    @Column("status")
    private String status;
}
