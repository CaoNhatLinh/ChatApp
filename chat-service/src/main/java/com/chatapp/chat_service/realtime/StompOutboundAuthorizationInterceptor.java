package com.chatapp.chat_service.realtime;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.ExecutorChannelInterceptor;
import org.springframework.stereotype.Component;

/** Re-check authority on the transport thread, not only when subscribing. */
@Component
public class StompOutboundAuthorizationInterceptor implements ExecutorChannelInterceptor {
    private final StompAuthenticationInterceptor access;

    public StompOutboundAuthorizationInterceptor(StompAuthenticationInterceptor access) {
        this.access = access;
    }

    @Override
    public Message<?> beforeHandle(Message<?> message, MessageChannel channel, MessageHandler handler) {
        if (SimpMessageHeaderAccessor.getMessageType(message.getHeaders()) != SimpMessageType.MESSAGE) {
            return message;
        }
        return access.canDeliver(message) ? message : null;
    }
}
