package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.chatapp.chat_service.message.dto.MessageSummary;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationSearchDto {
    private UUID conversationId;
    private String name;
    private String type;
    private String description;
    private String avatar;
    private Instant createdAt;
    private MessageSummary lastMessage;
    private UUID createdBy;
    private int memberCount;
    private List<UUID> memberIds;
}
