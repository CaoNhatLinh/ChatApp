package com.chatapp.chat_service.canonical.call;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Immutable discovery keys; callers must hydrate current call authority and access. */
public interface IncomingCallRepository {
    record Key(Instant deadline, UUID conversationId, UUID callId) {}

    void register(CallState call);
    List<Key> page(UUID callee, Instant since, Key after, int limit);
}
