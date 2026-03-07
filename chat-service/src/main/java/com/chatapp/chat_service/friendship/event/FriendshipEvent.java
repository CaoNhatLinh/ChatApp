package com.chatapp.chat_service.friendship.event;

import java.time.Instant;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Spring Application Event for friendship actions.
 * Listened by FriendshipEventListener to dispatch Kafka & WebSocket notifications.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendshipEvent {

    public enum Type {
        FRIEND_REQUEST_SENT,
        FRIEND_REQUEST_ACCEPTED,
        FRIEND_REQUEST_REJECTED,
        UNFRIENDED,
        BLOCKED,
        UNBLOCKED
    }

    private Type type;
    private UUID senderId;
    private UUID receiverId;
    private String senderDisplayName;
    @Builder.Default
    private Instant timestamp = Instant.now();
}
