package com.chatapp.chat_service.canonical.call;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Discovery/recovery work is separate from call authority, never another truth. */
public interface CallWorkRepository {
    int SHARDS = 16;
    enum Kind { PUBLISH, EXPIRE }
    record Key(Instant dueAt, UUID conversationId, UUID callId, UUID revision, Kind kind) { }
    record Work(Key key, Instant deadline, UUID expectedSlotRevision, Instant writeDeadline) { }
    record Progress(UUID revision, Key after) { }

    void register(CallRepository.Slot expected, CallState snapshot);
    List<Work> page(int shard, Key after, Instant through, int limit);
    void remove(Key key);
    Progress progress(int shard);
    boolean advance(int shard, Progress expected, Key after);
    static int shard(UUID conversationId) { return Math.floorMod(conversationId.hashCode(), SHARDS); }
}
