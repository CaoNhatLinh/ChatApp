package com.chatapp.chat_service.canonical.sticker;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public class CassandraStickerRepository implements StickerRepository {
    private static final String TABLE = "sticker_catalog_by_pack";
    private static final String UPDATE_PACK = "UPDATE " + TABLE + " SET pack_name=?, pack_description=?, cover_asset_id=?, is_official=?, pack_active=?, pack_revision=?, updated_at=? WHERE sticker_pack_id=? IF pack_revision=?;";
    private static final String COMMAND = "INSERT INTO " + TABLE + " (sticker_pack_id,entry_type,position,entry_id,command_json,audit_exported) VALUES (?,'COMMAND',0,?,?,false) IF NOT EXISTS;";
    private static final String PENDING = "INSERT INTO " + TABLE + " (sticker_pack_id,entry_type,position,entry_id,command_json) VALUES (?,'PENDING',0,?,?);";
    private static final String ITEM = "INSERT INTO " + TABLE + " (sticker_pack_id,entry_type,position,entry_id,name,asset_id,is_active,revision,sort_order) VALUES (?,'STICKER',0,?,?,?,?,?,?);";
    private static final String ORDER = "INSERT INTO " + TABLE + " (sticker_pack_id,entry_type,position,entry_id) VALUES (?,'ORDER',?,?);";
    private static final String DELETE_ORDER = "DELETE FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='ORDER' AND position=? AND entry_id=?;";
    private final CqlSession session;
    private final ObjectMapper mapper;
    private final PreparedStatement directory, directoryAfter, pack, items, itemsAfter, item, identity;
    private final PreparedStatement command, pending, exported, registerPack, registerIdentity;
    private final PreparedStatement createPack, updatePack, insertSticker, updateSticker, moveSticker;

    public CassandraStickerRepository(CqlSession session, ObjectMapper mapper) {
        this.session = session;
        this.mapper = mapper;
        directory = session.prepare("SELECT sticker_pack_id FROM sticker_pack_directory WHERE catalog = 'GLOBAL' LIMIT ?");
        directoryAfter = session.prepare("SELECT sticker_pack_id FROM sticker_pack_directory WHERE catalog = 'GLOBAL' AND sticker_pack_id > ? LIMIT ?");
        pack = session.prepare("SELECT * FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='PACK' AND position=0 AND entry_id=?");
        items = session.prepare("SELECT position,entry_id FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='ORDER' LIMIT ?");
        itemsAfter = session.prepare("SELECT position,entry_id FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='ORDER' AND (position,entry_id) > (?,?) LIMIT ?");
        item = session.prepare("SELECT * FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='STICKER' AND position=0 AND entry_id=?");
        identity = session.prepare("SELECT sticker_pack_id FROM sticker_identity_by_id WHERE sticker_id=?");
        command = session.prepare("SELECT command_json FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='COMMAND' AND position=0 AND entry_id=?");
        pending = session.prepare("SELECT entry_id,command_json FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='PENDING' AND position=0 LIMIT ?");
        exported = session.prepare("BEGIN BATCH UPDATE " + TABLE + " SET audit_exported=true WHERE sticker_pack_id=? AND entry_type='COMMAND' AND position=0 AND entry_id=? IF audit_exported=false; DELETE FROM " + TABLE + " WHERE sticker_pack_id=? AND entry_type='PENDING' AND position=0 AND entry_id=?; APPLY BATCH");
        registerPack = session.prepare("INSERT INTO sticker_pack_directory (catalog,sticker_pack_id) VALUES ('GLOBAL',?)");
        registerIdentity = session.prepare("INSERT INTO sticker_identity_by_id (sticker_id,sticker_pack_id) VALUES (?,?) IF NOT EXISTS");
        createPack = session.prepare("BEGIN BATCH INSERT INTO " + TABLE + " (sticker_pack_id,entry_type,position,entry_id,pack_name,pack_description,cover_asset_id,is_official,pack_active,pack_revision,updated_at) VALUES (?,'PACK',0,?,?,?,?,?,?,?,?) IF NOT EXISTS;" + COMMAND + PENDING + " APPLY BATCH");
        updatePack = session.prepare("BEGIN BATCH " + UPDATE_PACK + COMMAND + PENDING + " APPLY BATCH");
        insertSticker = session.prepare("BEGIN BATCH " + UPDATE_PACK + ITEM + ORDER + COMMAND + PENDING + " APPLY BATCH");
        updateSticker = session.prepare("BEGIN BATCH " + UPDATE_PACK + ITEM + COMMAND + PENDING + " APPLY BATCH");
        moveSticker = session.prepare("BEGIN BATCH " + UPDATE_PACK + ITEM + DELETE_ORDER + ORDER + COMMAND + PENDING + " APPLY BATCH");
    }

    @Override public List<UUID> packIds(UUID after, int limit) {
        return execute(after == null ? directory.bind(bounded(limit)) : directoryAfter.bind(after, bounded(limit)))
                .all().stream().map(row -> row.getUuid("sticker_pack_id")).toList();
    }
    @Override public Pack findPack(UUID id) {
        Row row = execute(pack.bind(id, id)).one();
        return row == null ? null : new Pack(id, row.getString("pack_name"), row.getString("pack_description"),
                row.getUuid("cover_asset_id"), row.getBoolean("is_official"), row.getBoolean("pack_active"),
                row.getUuid("pack_revision"), row.getInstant("updated_at"));
    }
    @Override public List<Position> positions(UUID packId, Position after, int limit) {
        var query = after == null ? items.bind(packId, bounded(limit))
                : itemsAfter.bind(packId, after.sortOrder(), after.stickerId(), bounded(limit));
        return execute(query).all().stream().map(row -> new Position(row.getInt("position"), row.getUuid("entry_id"))).toList();
    }
    @Override public Sticker findSticker(UUID id) {
        Row pointer = execute(identity.bind(id)).one();
        return pointer == null ? null : findSticker(pointer.getUuid("sticker_pack_id"), id);
    }
    @Override public Sticker findSticker(UUID packId, UUID id) {
        Row row = execute(item.bind(packId, id)).one();
        return row == null ? null : new Sticker(id, packId, row.getString("name"), row.getUuid("asset_id"),
                row.getInt("sort_order"), row.getBoolean("is_active"), row.getUuid("revision"));
    }
    @Override public Command findCommand(UUID packId, UUID id) {
        Row row = execute(command.bind(packId, id)).one();
        return row == null ? null : decode(row.getString("command_json"));
    }
    @Override public boolean createPack(Command c) {
        Pack p = c.pack();
        // Registration precedes authority; missing authority is filtered and the pointer is revisited.
        execute(registerPack.bind(p.stickerPackId()));
        return execute(createPack.bind(p.stickerPackId(), p.stickerPackId(), p.name(), p.description(),
                p.coverAssetId(), p.isOfficial(), p.isActive(), p.revision(), p.updatedAt(),
                p.stickerPackId(), c.commandId(), encode(c), p.stickerPackId(), c.commandId(), encode(c))).wasApplied();
    }
    @Override public boolean changePack(Command c, UUID expected) {
        return execute(updatePack.bind(packValues(c, expected))).wasApplied();
    }
    private Object[] packValues(Command c, UUID expected) {
        Pack p = c.pack();
        return new Object[]{p.name(), p.description(), p.coverAssetId(), p.isOfficial(), p.isActive(), p.revision(),
                p.updatedAt(), p.stickerPackId(), expected, p.stickerPackId(), c.commandId(), encode(c), p.stickerPackId(), c.commandId(), encode(c)};
    }
    @Override public boolean changeSticker(Command c, UUID expected, Sticker previous) {
        Sticker s = c.sticker();
        UUID packId = c.pack().stickerPackId();
        ResultSet registration = execute(registerIdentity.bind(s.stickerId(), packId));
        if (!registration.wasApplied()) {
            Row existing = execute(identity.bind(s.stickerId())).one();
            if (existing == null || !packId.equals(existing.getUuid("sticker_pack_id"))) return false;
        }
        var values = new java.util.ArrayList<Object>();
        Object[] pack = packValues(c, expected);
        values.addAll(java.util.Arrays.asList(pack).subList(0, 9));
        values.addAll(java.util.Arrays.asList(packId, s.stickerId(), s.name(), s.assetId(), s.isActive(), s.revision(), s.sortOrder()));
        PreparedStatement write = updateSticker;
        if (previous == null) {
            write = insertSticker;
            values.addAll(List.of(packId, s.sortOrder(), s.stickerId()));
        } else if (previous.sortOrder() != s.sortOrder()) {
            write = moveSticker;
            values.addAll(List.of(packId, previous.sortOrder(), s.stickerId(), packId, s.sortOrder(), s.stickerId()));
        }
        values.addAll(List.of(packId, c.commandId(), encode(c)));
        values.addAll(List.of(packId, c.commandId(), encode(c)));
        return execute(write.bind(values.toArray())).wasApplied();
    }
    @Override public List<CommandEntry> pendingCommands(UUID packId, int limit) {
        return execute(pending.bind(packId, bounded(limit)))
                .all().stream().map(row -> new CommandEntry(row.getUuid("entry_id"), decode(row.getString("command_json")))).toList();
    }
    @Override public void markAuditExported(UUID packId, UUID commandId) { execute(exported.bind(packId, commandId, packId, commandId)); }
    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_SERIAL));
    }
    private int bounded(int limit) { return Math.max(1, Math.min(51, limit)); }
    private String encode(Command value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Cannot persist sticker command", ex); }
    }
    private Command decode(String value) {
        try { return mapper.readValue(value, Command.class); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Invalid persisted sticker command", ex); }
    }
}
