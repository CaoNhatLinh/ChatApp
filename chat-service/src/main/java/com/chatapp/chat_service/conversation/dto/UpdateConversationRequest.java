package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request để cập nhật thông tin conversation
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateConversationRequest {
    private String name;
    private String description;
    private String backgroundUrl;
}
