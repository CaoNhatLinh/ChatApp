package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request để thêm member vào conversation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddMemberRequest {
    private List<UUID> memberIds;
}
