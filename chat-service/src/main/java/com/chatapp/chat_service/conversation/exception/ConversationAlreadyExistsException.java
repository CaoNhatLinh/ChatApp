package com.chatapp.chat_service.conversation.exception;

public class ConversationAlreadyExistsException extends RuntimeException {
    
    public ConversationAlreadyExistsException(String message) {
        super(message);
    }
    
    public ConversationAlreadyExistsException(String message, Throwable cause) {
        super(message, cause);
    }
}
