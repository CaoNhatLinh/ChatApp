package com.chatapp.chat_service.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

import com.chatapp.chat_service.auth.entity.User;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {
    private UUID userId;
    private String userName;
    private String displayName;
    private String nickName;
    private String avatarUrl;
    private Instant createdAt;
    private String statusPreference;

    public UserDTO(User user) {
        this.userId = user.getUserId();
        this.userName = user.getUsername();
        this.displayName = user.getDisplayName();
        this.nickName = user.getNickname();
        this.avatarUrl = user.getAvatarUrl();
        this.createdAt = user.getCreatedAt();
        this.statusPreference = user.getStatusPreference() != null ? user.getStatusPreference() : "ONLINE";
    }
}

