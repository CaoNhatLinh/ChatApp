package com.chatapp.chat_service.friendship.dto;


import java.time.Instant;
import java.util.UUID;

public class FriendRequestUpdate {
    private UUID userId;
    private String status; 
    private Instant timestamp;
    private String message;

    public FriendRequestUpdate() {
        this.timestamp = Instant.now();
    }

    public FriendRequestUpdate(UUID userId, String status) {
        this();
        this.userId = userId;
        this.status = status;
        this.message = "Friend request has been " + status.toLowerCase();
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}