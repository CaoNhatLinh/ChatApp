package com.chatapp.chat_service.canonical.call;

import java.time.Instant;
import java.util.UUID;

/** The slot and call snapshot are one conditional, single-partition mutation. */
public interface CallRepository {
    record Slot(UUID revision, UUID activeCallId) { }
    record Expiry(Instant deadline, UUID conversationId, UUID callId, UUID revision, UUID expectedSlotRevision) { }
    record Publication(CallState state, long publishedVersion) { }

    void initialize(UUID conversationId);
    Slot slot(UUID conversationId);
    CallState find(UUID conversationId, UUID callId);
    boolean claim(Slot expected, CallState call);
    boolean change(Slot expected, CallState before, CallState after);
    Publication publication(UUID conversationId, UUID callId);
    boolean markPublished(CallState state, long expectedPublishedVersion);
    boolean fenceSlot(UUID conversationId, Slot expected, UUID nextRevision);
}
