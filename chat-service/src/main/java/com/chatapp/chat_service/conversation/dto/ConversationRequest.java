package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversationRequest {
    private String name;
    private String description;
    private String type;
    private String created_by;
    private List<UUID> memberIds;
}
