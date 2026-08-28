package com.chatapp.chat_service.common.dto;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(
        int status,
        String code,
        String message,
        Map<String, String> fieldErrors,
        String correlationId,
        Instant timestamp,
        String path) {
}
