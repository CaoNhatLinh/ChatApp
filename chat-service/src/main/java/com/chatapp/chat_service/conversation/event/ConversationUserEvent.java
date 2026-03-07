package com.chatapp.chat_service.conversation.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

import com.chatapp.chat_service.auth.dto.UserDTO;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversationUserEvent {
    private UUID conversationId;
    private UserDTO user;
}
