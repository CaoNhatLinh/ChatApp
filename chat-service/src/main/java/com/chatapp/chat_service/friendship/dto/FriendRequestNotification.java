package com.chatapp.chat_service.friendship.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

import com.chatapp.chat_service.auth.entity.User;

import java.time.Instant;
import java.util.UUID;

public class FriendRequestNotification {
    private UUID senderId;
    private UUID receiverId;
    private String message;
    private Instant timestamp;
    private String type = "FRIEND_REQUEST";

    public FriendRequestNotification() {
        this.timestamp = Instant.now();
    }

    public FriendRequestNotification(UUID senderId, UUID receiverId) {
        this();
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.message = "You have a new friend request";
    }

    public UUID getSenderId() {
        return senderId;
    }

    public void setSenderId(UUID senderId) {
        this.senderId = senderId;
    }

    public UUID getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(UUID receiverId) {
        this.receiverId = receiverId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}

