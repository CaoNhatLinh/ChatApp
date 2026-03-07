package com.chatapp.chat_service.websocket.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SocketEvent {
    private String type;
    private Object payload;
}
