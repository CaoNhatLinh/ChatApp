package com.chatapp.chat_service.friendship.dto;

import java.util.UUID;

public class FriendRequestResponse {
    private UUID senderId;
    private UUID receiverId;
    private String status; 

    public FriendRequestResponse() {}

    public FriendRequestResponse(UUID senderId, UUID receiverId, String status) {
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.status = status;
    }

    public UUID getSenderId() { return senderId; }
    public void setSenderId(UUID senderId) { this.senderId = senderId; }
    public UUID getReceiverId() { return receiverId; }
    public void setReceiverId(UUID receiverId) { this.receiverId = receiverId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
