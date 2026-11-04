package com.chatapp.chat_service.canonical.call;

import java.util.Objects;
import java.util.UUID;

/** Server-owned scope for a state or ephemeral-signal delivery, never client authority. */
public record CallDelivery(UUID conversationId, UUID callId, UUID revision, Kind kind) {
    public enum Kind { STATE, SIGNAL }
    public CallDelivery {
        Objects.requireNonNull(conversationId); Objects.requireNonNull(callId);
        Objects.requireNonNull(revision); Objects.requireNonNull(kind);
    }
    public static CallDelivery of(CallState state, Kind kind) {
        return new CallDelivery(state.conversationId(), state.callId(), state.revision(), kind);
    }
}
