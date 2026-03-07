package com.chatapp.chat_service.message.exception;

public class MessageSaveException extends RuntimeException {
    public MessageSaveException(String message) {
        super(message);
    }
    
    public MessageSaveException(String message, Throwable cause) {
        super(message, cause);
    }
}