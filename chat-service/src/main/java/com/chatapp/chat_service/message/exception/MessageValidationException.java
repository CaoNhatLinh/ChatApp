package com.chatapp.chat_service.message.exception;

public class MessageValidationException extends RuntimeException {
    public MessageValidationException(String message) {
        super(message);
    }
    
    public MessageValidationException(String message, Throwable cause) {
        super(message, cause);
    }
}