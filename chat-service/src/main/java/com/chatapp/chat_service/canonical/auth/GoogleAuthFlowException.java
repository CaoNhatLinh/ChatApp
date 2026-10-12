package com.chatapp.chat_service.canonical.auth;

import org.springframework.http.HttpStatus;

public class GoogleAuthFlowException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public GoogleAuthFlowException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
