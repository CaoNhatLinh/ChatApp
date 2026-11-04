package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class CassandraCallRepository implements CallRepository {
    private static final String SLOT = "00000000-0000-0000-0000-000000000000";
    private final CqlSession session;
    private final ObjectMapper mapper;
    private final CallWorkRepository work;
    private final IncomingCallRepository incoming;
    private final CallHistoryRepository history;
    private final PreparedStatement initialize, slot, find, claim, change;
    private final PreparedStatement publication, markPublished, fenceSlot;

    public CassandraCallRepository(CqlSession session, ObjectMapper mapper, CallWorkRepository work,
                                   IncomingCallRepository incoming, CallHistoryRepository history) {
        this.session = session; this.mapper = mapper; this.work = work; this.incoming = incoming; this.history = history;
        initialize = session.prepare("INSERT INTO call_state_by_conversation (conversation_id,call_id,revision) VALUES (?," + SLOT + ",?) IF NOT EXISTS");
        slot = session.prepare("SELECT revision,active_call_id FROM call_state_by_conversation WHERE conversation_id=? AND call_id=" + SLOT);
        find = session.prepare("SELECT snapshot_json FROM call_state_by_conversation WHERE conversation_id=? AND call_id=?");
        publication = session.prepare("SELECT snapshot_json,published_version FROM call_state_by_conversation WHERE conversation_id=? AND call_id=?");
        markPublished = session.prepare("UPDATE call_state_by_conversation SET published_version=? WHERE conversation_id=? AND call_id=? IF revision=? AND published_version=?");
        fenceSlot = session.prepare("UPDATE call_state_by_conversation SET revision=? WHERE conversation_id=? AND call_id=" + SLOT + " IF revision=? AND active_call_id=?");
        claim = session.prepare("BEGIN BATCH UPDATE call_state_by_conversation SET revision=?,active_call_id=? WHERE conversation_id=? AND call_id=" + SLOT + " IF revision=? AND active_call_id=null;"
                + " INSERT INTO call_state_by_conversation (conversation_id,call_id,revision,snapshot_json,published_version) VALUES (?,?,?,?,0) IF NOT EXISTS; APPLY BATCH");
        change = session.prepare("BEGIN BATCH UPDATE call_state_by_conversation SET revision=?,active_call_id=? WHERE conversation_id=? AND call_id=" + SLOT + " IF revision=? AND active_call_id=?;"
                + " UPDATE call_state_by_conversation SET revision=?,snapshot_json=? WHERE conversation_id=? AND call_id=? IF revision=?; APPLY BATCH");
    }

    @Override public void initialize(UUID room) { execute(initialize.bind(room, UUID.randomUUID())); }
    @Override public Slot slot(UUID room) {
        Row row = execute(slot.bind(room)).one();
        return row == null ? null : new Slot(row.getUuid("revision"), row.getUuid("active_call_id"));
    }
    @Override public CallState find(UUID room, UUID id) {
        Row row = execute(find.bind(room, id)).one();
        return decode(row);
    }
    private CallState decode(Row row) {
        if (row == null || row.getString("snapshot_json") == null) return null;
        try { return mapper.readValue(row.getString("snapshot_json"), CallState.class); }
        catch (JsonProcessingException invalid) { throw new IllegalStateException("Invalid call authority", invalid); }
    }
    @Override public Publication publication(UUID room, UUID id) {
        Row row = execute(publication.bind(room, id)).one();
        CallState state = decode(row);
        return state == null ? null : new Publication(state, row.getLong("published_version"));
    }
    @Override public boolean markPublished(CallState state, long expectedPublishedVersion) {
        if (expectedPublishedVersion >= state.version()) throw new IllegalArgumentException("publication receipt must advance");
        return execute(markPublished.bind(state.version(), state.conversationId(), state.callId(), state.revision(), expectedPublishedVersion)).wasApplied();
    }
    @Override public boolean fenceSlot(UUID room, Slot expected, UUID nextRevision) {
        if (nextRevision.equals(expected.revision())) throw new IllegalArgumentException("slot fence must advance");
        return execute(fenceSlot.bind(nextRevision, room, expected.revision(), expected.activeCallId())).wasApplied();
    }
    @Override public boolean claim(Slot expected, CallState call) {
        history.register(call);
        incoming.register(call);
        work.register(expected, call);
        return execute(claim.bind(call.revision(), call.callId(), call.conversationId(), expected.revision(),
                call.conversationId(), call.callId(), call.revision(), encode(call))).wasApplied();
    }
    @Override public boolean change(Slot expected, CallState before, CallState after) {
        work.register(expected, after);
        return execute(change.bind(after.revision(), after.terminal() ? null : after.callId(), after.conversationId(),
                expected.revision(), before.callId(), after.revision(), encode(after), after.conversationId(), after.callId(), before.revision())).wasApplied();
    }
    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL).setIdempotent(false));
    }
    private String encode(CallState call) {
        try { return mapper.writeValueAsString(call); }
        catch (JsonProcessingException invalid) { throw new IllegalStateException("Cannot persist call authority", invalid); }
    }
}
