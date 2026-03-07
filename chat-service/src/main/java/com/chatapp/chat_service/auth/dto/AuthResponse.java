package com.chatapp.chat_service.auth.dto;


import java.util.UUID;

public record AuthResponse(
        String token,
        UUID userId,
        String username

) {
    public AuthResponse withoutToken() {
        return new AuthResponse(
                null, 
                userId,
                username
        );
    }
}