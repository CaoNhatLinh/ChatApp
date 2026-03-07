package com.chatapp.chat_service.friendship.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

import com.chatapp.chat_service.auth.dto.UserDTO;

@Data
public class FriendRequestsResponse {
    private UUID userId;
    private String status;
    private List<UserDTO> userDetails;

    public FriendRequestsResponse(UUID userId, String status, List<UserDTO> userDetails) {
        this.userId = userId;
        this.status = status;
        this.userDetails = userDetails;
    }

}

