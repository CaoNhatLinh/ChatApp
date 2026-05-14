package com.chatapp.chat_service.conversation.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationManagementEvent {
    public enum Action {
        CREATED, UPDATED, DELETED, RESTORED, 
        MEMBER_ADDED, MEMBER_REMOVED, MEMBER_LEFT, 
        ROLE_UPDATED, OWNERSHIP_TRANSFERRED
    }

    private Action action;
    private UUID conversationId;
    private UUID actorId; // The person who performed the action
    private List<UUID> affectedUserIds; // e.g., the member being added/removed
    private Object metadata; // Extra data like new name, new role, etc.
    private Instant timestamp;
}
