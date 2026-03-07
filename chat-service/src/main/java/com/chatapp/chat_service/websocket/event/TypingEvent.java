package com.chatapp.chat_service.websocket.event;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TypingEvent {

    private UUID conversationId;
    private UserDTO user;
    
    @JsonProperty("isTyping")
    private boolean typing;
    
    public boolean isTyping() {
        return typing;
    }
    
    public void setTyping(boolean typing) {
        this.typing = typing;
    }
}