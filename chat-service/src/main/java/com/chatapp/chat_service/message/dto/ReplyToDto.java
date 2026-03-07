package com.chatapp.chat_service.message.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

import com.chatapp.chat_service.auth.dto.UserDTO;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReplyToDto {
    private UUID messageId;
    private String content;
    private UserDTO sender;
}
