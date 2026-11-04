package com.chatapp.chat_service.canonical.media;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public class CassandraMediaUploadRecoveryRepository implements MediaUploadRecoveryRepository {
    private final CqlSession session;
    private final PreparedStatement register;
    private final PreparedStatement firstPage;
    private final PreparedStatement nextPage;
    private final PreparedStatement remove;

    public CassandraMediaUploadRecoveryRepository(CqlSession session) {
        this.session = session;
        register = session.prepare("""
                INSERT INTO media_upload_recovery_by_shard (shard, asset_id, owner_id, upload_id)
                VALUES (?, ?, ?, ?)
                """);
        firstPage = session.prepare("""
                SELECT asset_id, owner_id, upload_id FROM media_upload_recovery_by_shard
                WHERE shard = ? LIMIT ?
                """);
        nextPage = session.prepare("""
                SELECT asset_id, owner_id, upload_id FROM media_upload_recovery_by_shard
                WHERE shard = ? AND asset_id > ? LIMIT ?
                """);
        remove = session.prepare("DELETE FROM media_upload_recovery_by_shard WHERE shard = ? AND asset_id = ?");
    }

    @Override
    public void register(Work work) {
        session.execute(register.bind(shard(work.assetId()), work.assetId(), work.ownerId(), work.uploadId())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM).setIdempotent(true));
    }

    @Override
    public List<Work> list(int shard, UUID after, int limit) {
        if (shard < 0 || shard >= SHARDS) throw new IllegalArgumentException("Invalid media upload recovery shard");
        int bounded = Math.max(1, Math.min(100, limit));
        var query = after == null ? firstPage.bind(shard, bounded) : nextPage.bind(shard, after, bounded);
        return session.execute(query.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all().stream()
                .map(row -> new Work(row.getUuid("asset_id"), row.getUuid("owner_id"), row.getUuid("upload_id")))
                .toList();
    }

    @Override
    public void remove(Work work) {
        session.execute(remove.bind(shard(work.assetId()), work.assetId())
                .setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM).setIdempotent(true));
    }

    private static int shard(UUID assetId) {
        return Math.floorMod(assetId.hashCode(), SHARDS);
    }
}
