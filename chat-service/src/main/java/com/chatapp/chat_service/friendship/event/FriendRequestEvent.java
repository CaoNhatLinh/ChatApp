package com.chatapp.chat_service.friendship.event;

import java.time.Instant;
import java.util.UUID;

public class FriendRequestEvent {
    private UUID senderId;
    private UUID receiverId;
    private Instant timestamp = Instant.now();

    public FriendRequestEvent() {}

    public FriendRequestEvent(UUID senderId, UUID receiverId) {
        this.senderId = senderId;
        this.receiverId = receiverId;
    }

    public UUID getSenderId() { return senderId; }
    public void setSenderId(UUID senderId) { this.senderId = senderId; }
    public UUID getReceiverId() { return receiverId; }
    public void setReceiverId(UUID receiverId) { this.receiverId = receiverId; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}