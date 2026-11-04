package com.chatapp.chat_service.canonical.media;

import java.util.List;
import java.util.UUID;

public interface MediaOrphanRepository {
    int SHARDS = 16;

    record Work(UUID assetId, UUID ownerId) { }

    void register(Work work);
    List<Work> list(int shard, UUID after, int limit);
    void remove(Work work);
}
