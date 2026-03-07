package com.chatapp.chat_service.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {
    private String message;
    private Instant timestamp = Instant.now();

    public ErrorResponse(String message) {
        this.message = message;
    }
}