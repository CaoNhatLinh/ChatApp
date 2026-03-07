package com.chatapp.chat_service.presence.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class OnlineStatusResponse {
    private Map<UUID, Boolean> statusMap;
    private Instant timestamp;
}