package com.chatapp.chat_service.friendship.dto;

import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.friendship.entity.Friendship;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendDTO {
    private UUID friendId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private Instant friendsSince;
    private boolean isOnline;
    
    public static FriendDTO fromFriendship(Friendship friendship, User friend) {
        return FriendDTO.builder()
                .friendId(friend.getUserId())
                .username(friend.getUsername())
                .displayName(friend.getDisplayName())
                .avatarUrl(friend.getAvatarUrl())
                .friendsSince(friendship.getCreatedAt())
                .isOnline(false)
                .build();
    }
}
