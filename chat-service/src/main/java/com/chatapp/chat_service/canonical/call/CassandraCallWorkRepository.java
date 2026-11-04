package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/** Discovery is durable; authority remains the single-partition call repository. */
@Repository
public class CassandraCallWorkRepository implements CallWorkRepository {
    private static final UUID MAX_UUID = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private final CqlSession session;
    private final Clock clock;
    private final PreparedStatement register, page, pageAfter, remove, progress, initialize, advance;
    @Autowired public CassandraCallWorkRepository(CqlSession session) { this(session, Clock.systemUTC()); }
    CassandraCallWorkRepository(CqlSession session, Clock clock) {
        this.session = session; this.clock = clock;
        register = session.prepare("INSERT INTO call_work_by_shard (shard,due_at,conversation_id,call_id,revision,kind,deadline,expected_slot_revision,write_deadline) VALUES (?,?,?,?,?,?,?,?,?)");
        String select = "SELECT * FROM call_work_by_shard WHERE shard=?";
        String upper = " AND (due_at,conversation_id,call_id,revision,kind) <= (?,?,?,?,?) LIMIT ?";
        page = session.prepare(select + upper);
        pageAfter = session.prepare(select + " AND (due_at,conversation_id,call_id,revision,kind) > (?,?,?,?,?)" + upper);
        remove = session.prepare("DELETE FROM call_work_by_shard WHERE shard=? AND due_at=? AND conversation_id=? AND call_id=? AND revision=? AND kind=?");
        progress = session.prepare("SELECT * FROM call_work_progress_by_shard WHERE shard=?");
        initialize = session.prepare("INSERT INTO call_work_progress_by_shard (shard,revision) VALUES (?,?) IF NOT EXISTS");
        advance = session.prepare("UPDATE call_work_progress_by_shard SET revision=?,cursor_due_at=?,cursor_room=?,cursor_call=?,cursor_revision=?,cursor_kind=? WHERE shard=? IF revision=?");
    }
    @Override public void register(CallRepository.Slot expected, CallState snapshot) {
        Instant writeDeadline = clock.instant().truncatedTo(ChronoUnit.MILLIS).plusSeconds(30);
        register(snapshot, expected, Kind.PUBLISH, Instant.EPOCH, writeDeadline);
        if (!snapshot.terminal()) register(snapshot, expected, Kind.EXPIRE, snapshot.deadline(), writeDeadline);
    }
    private void register(CallState state, CallRepository.Slot expected, Kind kind, Instant due, Instant writeDeadline) {
        execute(register.bind(shard(state.conversationId()), due, state.conversationId(), state.callId(), state.revision(), kind.name(), state.deadline(), expected.revision(), writeDeadline));
    }
    @Override public List<Work> page(int shard, Key after, Instant through, int limit) {
        checkShard(shard);
        if (limit < 1 || limit > 101) throw new IllegalArgumentException("bounded call work page is required");
        var values = new ArrayList<Object>(); values.add(shard);
        if (after != null) values.addAll(keyValues(after));
        values.addAll(List.of(through, MAX_UUID, MAX_UUID, MAX_UUID, "zz", limit));
        var rows = new ArrayList<Work>();
        for (Row row : execute((after == null ? page : pageAfter).bind(values.toArray()))) {
            Key key = new Key(row.getInstant("due_at"), row.getUuid("conversation_id"), row.getUuid("call_id"), row.getUuid("revision"), Kind.valueOf(row.getString("kind")));
            rows.add(new Work(key, row.getInstant("deadline"), row.getUuid("expected_slot_revision"), row.getInstant("write_deadline")));
        }
        return List.copyOf(rows);
    }
    @Override public void remove(Key key) {
        var values = new ArrayList<Object>(); values.add(shard(key.conversationId())); values.addAll(keyValues(key));
        execute(remove.bind(values.toArray()));
    }
    @Override public Progress progress(int shard) {
        checkShard(shard);
        Row row = execute(progress.bind(shard)).one();
        if (row == null) { execute(initialize.bind(shard, UUID.randomUUID())); row = execute(progress.bind(shard)).one(); }
        if (row == null) throw new IllegalStateException("call worker checkpoint is missing");
        Key after = row.getInstant("cursor_due_at") == null ? null : new Key(row.getInstant("cursor_due_at"), row.getUuid("cursor_room"), row.getUuid("cursor_call"), row.getUuid("cursor_revision"), Kind.valueOf(row.getString("cursor_kind")));
        return new Progress(row.getUuid("revision"), after);
    }
    @Override public boolean advance(int shard, Progress expected, Key after) {
        checkShard(shard);
        var values = new ArrayList<Object>(); values.add(UUID.randomUUID());
        values.addAll(after == null ? Arrays.asList(null, null, null, null, null) : keyValues(after));
        values.add(shard); values.add(expected.revision());
        return execute(advance.bind(values.toArray())).wasApplied();
    }
    private List<Object> keyValues(Key key) { return List.of(key.dueAt(), key.conversationId(), key.callId(), key.revision(), key.kind().name()); }
    private void checkShard(int shard) { if (shard < 0 || shard >= SHARDS) throw new IllegalArgumentException("invalid call work shard"); }
    private int shard(UUID room) { return CallWorkRepository.shard(room); }
    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL).setIdempotent(false));
    }
}
