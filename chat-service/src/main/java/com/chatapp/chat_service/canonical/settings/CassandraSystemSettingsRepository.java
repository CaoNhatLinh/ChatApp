package com.chatapp.chat_service.canonical.settings;

import com.datastax.oss.driver.api.core.*;
import com.datastax.oss.driver.api.core.cql.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class CassandraSystemSettingsRepository implements SystemSettingsRepository {
    private static final String COMMAND = "INSERT INTO system_settings_by_key (setting_key,entry_type,command_id,command_json,audit_exported) VALUES (?,'COMMAND',?,?,false) IF NOT EXISTS;";
    private static final String PENDING = "INSERT INTO system_settings_by_key (setting_key,entry_type,command_id,command_json) VALUES (?,'PENDING',?,?);";
    private final CqlSession session;
    private final ObjectMapper mapper;
    private final PreparedStatement state, command, first, update, pending, pendingAfter, exported;

    public CassandraSystemSettingsRepository(CqlSession session, ObjectMapper mapper) {
        this.session = session; this.mapper = mapper;
        state = session.prepare("SELECT setting_value,revision,updated_by,updated_at FROM system_settings_by_key WHERE setting_key=? AND entry_type='STATE' AND command_id=?");
        command = session.prepare("SELECT command_json FROM system_settings_by_key WHERE setting_key=? AND entry_type='COMMAND' AND command_id=?");
        first = session.prepare("BEGIN BATCH INSERT INTO system_settings_by_key (setting_key,entry_type,command_id,setting_value,revision,updated_by,updated_at) VALUES (?,'STATE',?,?,?,?,?) IF NOT EXISTS;" + COMMAND + PENDING + " APPLY BATCH");
        update = session.prepare("BEGIN BATCH UPDATE system_settings_by_key SET setting_value=?,revision=?,updated_by=?,updated_at=? WHERE setting_key=? AND entry_type='STATE' AND command_id=? IF revision=?;" + COMMAND + PENDING + " APPLY BATCH");
        pending = session.prepare("SELECT command_id,command_json FROM system_settings_by_key WHERE setting_key=? AND entry_type='PENDING' LIMIT ?");
        pendingAfter = session.prepare("SELECT command_id,command_json FROM system_settings_by_key WHERE setting_key=? AND entry_type='PENDING' AND command_id>? LIMIT ?");
        exported = session.prepare("BEGIN BATCH UPDATE system_settings_by_key SET audit_exported=true WHERE setting_key=? AND entry_type='COMMAND' AND command_id=? IF audit_exported=false; DELETE FROM system_settings_by_key WHERE setting_key=? AND entry_type='PENDING' AND command_id=?; APPLY BATCH");
    }

    @Override public State find(String key) {
        var row = execute(state.bind(key, PRISTINE_REVISION)).one();
        if (row == null) return null;
        UUID revision = row.getUuid("revision"), actor = row.getUuid("updated_by");
        var at = row.getInstant("updated_at");
        if (revision == null || PRISTINE_REVISION.equals(revision) || actor == null || at == null) {
            throw new IllegalStateException("invalid persisted system setting metadata");
        }
        return new State(key, row.getString("setting_value"), revision, actor, at);
    }
    @Override public Command findCommand(String key, UUID id) {
        var row = execute(command.bind(key, id)).one();
        return row == null ? null : decode(key, id, row.getString("command_json"));
    }
    @Override public boolean save(Command command, UUID expectedRevision) {
        State s = command.state();
        String json = encode(command);
        if (PRISTINE_REVISION.equals(expectedRevision)) {
            return execute(first.bind(s.key(), PRISTINE_REVISION, s.value(), s.revision(), s.updatedBy(), s.updatedAt(),
                    s.key(), command.commandId(), json, s.key(), command.commandId(), json)).wasApplied();
        }
        return execute(update.bind(s.value(), s.revision(), s.updatedBy(), s.updatedAt(), s.key(), PRISTINE_REVISION, expectedRevision,
                s.key(), command.commandId(), json, s.key(), command.commandId(), json)).wasApplied();
    }
    @Override public List<Command> pending(String key, UUID after, int limit) {
        int bounded = Math.max(1, Math.min(25, limit));
        return execute(after == null ? pending.bind(key, bounded) : pendingAfter.bind(key, after, bounded))
                .all().stream().map(row -> decode(key, row.getUuid("command_id"), row.getString("command_json"))).toList();
    }
    @Override public void markAuditExported(String key, UUID id) { execute(exported.bind(key, id, key, id)); }
    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL));
    }
    private String encode(Command command) {
        try { return mapper.writeValueAsString(command); }
        catch (JsonProcessingException invalid) { throw new IllegalStateException("cannot encode system setting command", invalid); }
    }
    private Command decode(String key, UUID id, String json) {
        try {
            Command command = mapper.readValue(json, Command.class);
            if (command == null || command.state() == null || command.audit() == null || !id.equals(command.commandId())
                    || !key.equals(command.state().key()) || !id.equals(command.state().revision())
                    || !Objects.equals(command.actorId(), command.state().updatedBy())
                    || !id.equals(command.audit().requestId()) || !key.equals(command.audit().resourceId())) {
                throw new IllegalStateException("invalid persisted system setting command identity");
            }
            return command;
        } catch (JsonProcessingException invalid) { throw new IllegalStateException("invalid persisted system setting command", invalid); }
    }
}
