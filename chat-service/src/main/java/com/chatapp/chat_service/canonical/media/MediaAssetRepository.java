package com.chatapp.chat_service.canonical.media;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

@Repository
public class MediaAssetRepository {
    private final CqlSession session;
    private final PreparedStatement insert;
    private final PreparedStatement select;
    private final PreparedStatement markDeleted;
    private final PreparedStatement retain;
    private final PreparedStatement claimDeletion;
    private final PreparedStatement claimOrphan;
    private final PreparedStatement orphanState;
    private final PreparedStatement insertThumbnail;
    private final PreparedStatement selectThumbnails;
    private final PreparedStatement claimUpload;
    private final PreparedStatement completeUpload;
    private final PreparedStatement selectReceipt;
    private final ObjectMapper mapper;

    public MediaAssetRepository(CqlSession session, ObjectMapper mapper) {
        this.session = session;
        this.mapper = mapper;
        this.insert = session.prepare("""
                INSERT INTO media_assets_by_id
                    (asset_id, owner_id, storage_provider, storage_key, public_url, file_name, mime_type,
                     byte_size, width, height, duration_ms, checksum_sha256, upload_status,
                     malware_scan_status, moderation_status, created_at, deleted_at, retention_locked)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false)
                """);
        this.select = session.prepare("SELECT * FROM media_assets_by_id WHERE asset_id = ?");
        this.completeUpload = session.prepare("""
                UPDATE media_assets_by_id SET public_url=?,width=?,height=?,duration_ms=?,upload_receipt=?,upload_status='READY'
                WHERE asset_id=? IF upload_status='PENDING' AND checksum_sha256=? AND owner_id=? AND deleted_at=null
                """);
        this.selectReceipt = session.prepare("SELECT upload_receipt FROM media_assets_by_id WHERE asset_id=?");
        this.claimUpload = session.prepare("""
                INSERT INTO media_assets_by_id
                (asset_id,owner_id,storage_provider,storage_key,file_name,mime_type,byte_size,checksum_sha256,
                 upload_status,malware_scan_status,moderation_status,created_at,retention_locked,upload_purpose)
                VALUES (?,?,?,?,?,?,?,?,'PENDING','PENDING','PENDING',?,false,?) IF NOT EXISTS
                """);
        this.markDeleted = session.prepare("""
                UPDATE media_assets_by_id SET upload_status = 'DELETED', deleted_at = ? WHERE asset_id = ?
                IF upload_status = 'DELETING' AND deleted_at = null
                """);
        this.retain = session.prepare("UPDATE media_assets_by_id SET retention_locked=true WHERE asset_id=? IF upload_status='READY' AND deleted_at=null");
        this.claimDeletion = session.prepare("UPDATE media_assets_by_id SET upload_status='DELETING' WHERE asset_id=? IF upload_status='READY' AND retention_locked=false AND deleted_at=null");
        this.claimOrphan = session.prepare("""
                UPDATE media_assets_by_id SET upload_status='DELETING' WHERE asset_id=?
                IF owner_id=? AND storage_provider='CLOUDINARY' AND upload_purpose='COMPOSER'
                AND upload_status='READY' AND retention_locked=false AND deleted_at=null AND created_at <= ?
                """);
        this.orphanState = session.prepare("""
                SELECT owner_id, storage_provider, upload_purpose, upload_status, retention_locked, created_at, deleted_at
                FROM media_assets_by_id WHERE asset_id=?
                """);
        this.insertThumbnail = session.prepare("""
                INSERT INTO media_thumbnails_by_asset
                    (asset_id, variant, status, thumbnail_url, width, height, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """);
        this.selectThumbnails = session.prepare("SELECT variant, status, thumbnail_url, width, height, created_at FROM media_thumbnails_by_asset WHERE asset_id=? LIMIT 4");
    }

    public void save(MediaAsset asset) {
        session.execute(bindAsset(asset));
    }

    public boolean claimUpload(MediaAsset asset) {
        return execute(claimUpload.bind(asset.assetId(), asset.ownerId(), asset.storageProvider(), asset.storageKey(),
                asset.fileName(), asset.mimeType(), asset.byteSize(), asset.checksumSha256(), asset.createdAt(),
                asset.uploadPurpose())).wasApplied();
    }

    public boolean completeUpload(MediaUploadReceipt receipt) {
        MediaAsset asset = receipt.asset();
        return execute(completeUpload.bind(asset.publicUrl(), asset.width(), asset.height(), asset.durationMs(), encode(receipt),
                asset.assetId(), asset.checksumSha256(), asset.ownerId())).wasApplied();
    }

    public MediaUploadReceipt findUploadReceipt(UUID assetId) {
        Row row = execute(selectReceipt.bind(assetId)).one();
        if (row == null || row.getString("upload_receipt") == null) throw new IllegalStateException("missing upload receipt");
        try {
            MediaUploadReceipt receipt = mapper.readValue(row.getString("upload_receipt"), MediaUploadReceipt.class);
            if (receipt == null || !assetId.equals(receipt.asset().assetId())) throw new IllegalStateException("invalid upload receipt identity");
            return receipt;
        } catch (JsonProcessingException invalid) { throw new IllegalStateException("invalid upload receipt", invalid); }
    }

    public void repairUploadThumbnails(MediaUploadReceipt receipt) {
        if (receipt.thumbnails().isEmpty()) return;
        var batch = BatchStatement.builder(BatchType.LOGGED).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        for (var thumbnail : receipt.thumbnails()) batch.addStatement(insertThumbnail.bind(receipt.asset().assetId(),
                thumbnail.variant().name(), thumbnail.status().name(), thumbnail.url(), thumbnail.width(), thumbnail.height(), thumbnail.createdAt()));
        session.execute(batch.build());
    }

    private String encode(MediaUploadReceipt receipt) {
        try { return mapper.writeValueAsString(receipt); }
        catch (JsonProcessingException invalid) { throw new IllegalStateException("cannot encode upload receipt", invalid); }
    }
    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL));
    }

    public List<MediaThumbnail> findThumbnails(UUID assetId) {
        var thumbnails = new ArrayList<MediaThumbnail>();
        for (Row row : execute(selectThumbnails.bind(assetId))) {
            if (thumbnails.size() == MediaThumbnail.Variant.values().length) throw new IllegalStateException("unexpected thumbnail variant");
            thumbnails.add(new MediaThumbnail(MediaThumbnail.Variant.valueOf(row.getString("variant")),
                    MediaThumbnail.Status.valueOf(row.getString("status")), row.getString("thumbnail_url"),
                    row.isNull("width") ? null : row.getInt("width"), row.isNull("height") ? null : row.getInt("height"),
                    row.getInstant("created_at")));
        }
        thumbnails.sort(java.util.Comparator.comparing(MediaThumbnail::variant));
        return List.copyOf(thumbnails);
    }

    private BoundStatement bindAsset(MediaAsset asset) {
        return insert.bind(
                asset.assetId(), asset.ownerId(), asset.storageProvider(), asset.storageKey(), asset.publicUrl(),
                asset.fileName(), asset.mimeType(), asset.byteSize(), asset.width(), asset.height(), asset.durationMs(),
                asset.checksumSha256(), asset.uploadStatus(), asset.malwareScanStatus(), asset.moderationStatus(),
                asset.createdAt(), asset.deletedAt());
    }

    public MediaAsset findById(UUID assetId) {
        Row row = execute(select.bind(assetId)).one();
        return row == null ? null : new MediaAsset(
                row.getUuid("asset_id"), row.getUuid("owner_id"), row.getString("storage_provider"),
                row.getString("storage_key"), row.getString("public_url"), row.getString("file_name"),
                row.getString("mime_type"), row.getLong("byte_size"),
                row.isNull("width") ? null : row.getInt("width"),
                row.isNull("height") ? null : row.getInt("height"),
                row.isNull("duration_ms") ? null : row.getLong("duration_ms"),
                row.getString("checksum_sha256"), row.getString("upload_status"),
                row.getString("malware_scan_status"), row.getString("moderation_status"),
                row.getInstant("created_at"), row.getInstant("deleted_at"), row.getString("upload_purpose"));
    }

    public boolean markDeleted(UUID assetId, Instant deletedAt) {
        return execute(markDeleted.bind(deletedAt, assetId)).wasApplied();
    }

    public boolean retainForHistory(UUID assetId) { return execute(retain.bind(assetId)).wasApplied(); }
    public boolean claimDeletion(UUID assetId) { return execute(claimDeletion.bind(assetId)).wasApplied(); }

    OrphanState orphanState(MediaOrphanRepository.Work work, Instant cutoff) {
        Row row = execute(orphanState.bind(work.assetId())).one();
        if (row == null) return OrphanState.WAITING; // The candidate may precede the authority write.
        if (!work.ownerId().equals(row.getUuid("owner_id")) || !"CLOUDINARY".equals(row.getString("storage_provider"))
                || !"COMPOSER".equals(row.getString("upload_purpose")) || row.getBoolean("retention_locked")
                || row.getInstant("deleted_at") != null) return OrphanState.DISCARD;
        String status = row.getString("upload_status");
        if ("DELETING".equals(status) || "DELETED".equals(status) || "QUARANTINED".equals(status)) return OrphanState.DISCARD;
        Instant createdAt = row.getInstant("created_at");
        return "READY".equals(status) && !row.isNull("retention_locked") && createdAt != null && !createdAt.isAfter(cutoff)
                ? OrphanState.ELIGIBLE : OrphanState.WAITING;
    }

    boolean claimOrphan(MediaOrphanRepository.Work work, Instant cutoff) {
        return execute(claimOrphan.bind(work.assetId(), work.ownerId(), cutoff)).wasApplied();
    }

    enum OrphanState { WAITING, ELIGIBLE, DISCARD }
}
