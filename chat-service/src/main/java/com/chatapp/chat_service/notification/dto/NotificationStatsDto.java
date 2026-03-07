package com.chatapp.chat_service.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationStatsDto {
    private UUID userId;
    private long totalCount;
    private long unreadCount;
    private long readCount;
    private long weeklyCount;
    private Map<String, Long> typeStats;
    private Instant lastUpdated;
    
    private long messageCount;
    private long mentionCount;
    private long reactionCount;
    private long systemCount;
}
