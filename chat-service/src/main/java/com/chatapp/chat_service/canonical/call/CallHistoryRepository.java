package com.chatapp.chat_service.canonical.call;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Immutable discovery keys only; CallRepository remains the lifecycle authority. */
public interface CallHistoryRepository {
    record Key(UUID startedOrder, UUID conversationId, UUID callId) { }
    void register(CallState call);
    List<Key> own(UUID actor, YearMonth month, Key after, int limit);
    List<Key> conversation(UUID room, YearMonth month, Key after, int limit);
}
