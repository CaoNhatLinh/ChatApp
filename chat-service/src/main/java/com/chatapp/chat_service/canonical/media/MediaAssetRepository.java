package com.chatapp.chat_service.canonical.media;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public class MediaAssetRepository {
    private final CqlSession session;
    private final PreparedStatement insert;
    private final PreparedStatement select;
    private final PreparedStatement markDeleted;

    public MediaAssetRepository(CqlSession session) {
        this.session = session;
        this.insert = session.prepare("""
                INSERT INTO media_assets_by_id
                    (asset_id, owner_id, storage_provider, storage_key, public_url, file_name, mime_type,
                     byte_size, width, height, duration_ms, checksum_sha256, upload_status,
                     malware_scan_status, moderation_status, created_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """);
        this.select = session.prepare("SELECT * FROM media_assets_by_id WHERE asset_id = ?");
        this.markDeleted = session.prepare("""
                UPDATE media_assets_by_id SET upload_status = 'DELETED', deleted_at = ? WHERE asset_id = ?
                """);
    }

    public void save(MediaAsset asset) {
        session.execute(insert.bind(
                asset.assetId(), asset.ownerId(), asset.storageProvider(), asset.storageKey(), asset.publicUrl(),
                asset.fileName(), asset.mimeType(), asset.byteSize(), asset.width(), asset.height(), asset.durationMs(),
                asset.checksumSha256(), asset.uploadStatus(), asset.malwareScanStatus(), asset.moderationStatus(),
                asset.createdAt(), asset.deletedAt()));
    }

    public MediaAsset findById(UUID assetId) {
        Row row = session.execute(select.bind(assetId)).one();
        return row == null ? null : new MediaAsset(
                row.getUuid("asset_id"), row.getUuid("owner_id"), row.getString("storage_provider"),
                row.getString("storage_key"), row.getString("public_url"), row.getString("file_name"),
                row.getString("mime_type"), row.getLong("byte_size"),
                row.isNull("width") ? null : row.getInt("width"),
                row.isNull("height") ? null : row.getInt("height"),
                row.isNull("duration_ms") ? null : row.getLong("duration_ms"),
                row.getString("checksum_sha256"), row.getString("upload_status"),
                row.getString("malware_scan_status"), row.getString("moderation_status"),
                row.getInstant("created_at"), row.getInstant("deleted_at"));
    }

    public void markDeleted(UUID assetId, Instant deletedAt) {
        session.execute(markDeleted.bind(deletedAt, assetId));
    }
}
