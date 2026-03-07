package com.chatapp.chat_service.message.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

import com.chatapp.chat_service.auth.dto.UserDTO;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReactionDto {
    private UUID messageId;
    private String emoji; 
    private LocalDateTime createdAt;
    private UserDTO user;

}
