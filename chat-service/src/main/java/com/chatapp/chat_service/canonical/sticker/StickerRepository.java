package com.chatapp.chat_service.canonical.sticker;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A pack is one CAS aggregate; directory and identity rows are discovery pointers only. */
public interface StickerRepository {
    List<UUID> packIds(UUID after, int limit);
    Pack findPack(UUID packId);
    List<Position> positions(UUID packId, Position after, int limit);
    Sticker findSticker(UUID stickerId);
    Sticker findSticker(UUID packId, UUID stickerId);
    Command findCommand(UUID packId, UUID commandId);
    boolean createPack(Command command);
    boolean changePack(Command command, UUID expectedRevision);
    boolean changeSticker(Command command, UUID expectedRevision, Sticker previous);
    List<CommandEntry> pendingCommands(UUID packId, int limit);
    void markAuditExported(UUID packId, UUID commandId);

    record Pack(UUID stickerPackId, String name, String description, UUID coverAssetId,
                boolean isOfficial, boolean isActive, UUID revision, Instant updatedAt) { }
    record Sticker(UUID stickerId, UUID stickerPackId, String name, UUID assetId,
                   int sortOrder, boolean isActive, UUID revision) { }
    record Position(int sortOrder, UUID stickerId) { }
    record Command(UUID commandId, UUID actorId, String fingerprint, Pack pack, Sticker sticker,
                   com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent audit) { }
    record CommandEntry(UUID commandId, Command command) { }
}
