package com.chatapp.chat_service.friendship.event;

import java.time.Instant;
import java.util.UUID;

import com.chatapp.chat_service.friendship.entity.Friendship;

public class FriendshipStatusEvent {
    private UUID senderId;
    private UUID receiverId;
    private String status; 
    private Instant timestamp = Instant.now();

    public FriendshipStatusEvent() {}

    public FriendshipStatusEvent(UUID senderId, UUID receiverId, Friendship.Status status) {
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.status = String.valueOf(status);
    }

    public UUID getSenderId() { return senderId; }
    public void setSenderId(UUID senderId) { this.senderId = senderId; }
    public UUID getReceiverId() { return receiverId; }
    public void setReceiverId(UUID receiverId) { this.receiverId = receiverId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}