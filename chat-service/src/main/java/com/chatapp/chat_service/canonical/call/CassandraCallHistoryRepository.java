package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class CassandraCallHistoryRepository implements CallHistoryRepository {
    private final CqlSession session;
    private final PreparedStatement insertRoom, insertUser, ownHead, ownAfter, roomHead, roomAfter;

    public CassandraCallHistoryRepository(CqlSession session) {
        this.session = session;
        insertRoom = session.prepare("INSERT INTO calls_by_conversation (conversation_id,call_month,started_at,call_id) VALUES (?,?,?,?)");
        insertUser = session.prepare("INSERT INTO calls_by_user (user_id,call_month,started_at,conversation_id,call_id) VALUES (?,?,?,?,?)");
        ownHead = session.prepare("SELECT started_at,conversation_id,call_id FROM calls_by_user WHERE user_id=? AND call_month=? LIMIT ?");
        ownAfter = session.prepare("SELECT started_at,conversation_id,call_id FROM calls_by_user WHERE user_id=? AND call_month=? AND (started_at,conversation_id,call_id)<(?,?,?) LIMIT ?");
        roomHead = session.prepare("SELECT started_at,call_id FROM calls_by_conversation WHERE conversation_id=? AND call_month=? LIMIT ?");
        roomAfter = session.prepare("SELECT started_at,call_id FROM calls_by_conversation WHERE conversation_id=? AND call_month=? AND (started_at,call_id)<(?,?) LIMIT ?");
    }

    @Override public void register(CallState call) {
        if (call == null || call.status() != CallState.Status.RINGING || call.version() != 1
                || !id(call.conversationId()) || !id(call.callId()) || !id(call.callerId()) || !id(call.calleeId())
                || call.callerId().equals(call.calleeId()) || call.createdAt() == null || call.startedOrder() == null
                || !call.createdAt().equals(Instant.ofEpochMilli(call.createdAt().toEpochMilli()))
                || !call.startedOrder().equals(Uuids.startOf(call.createdAt().toEpochMilli()))) {
            throw new IllegalArgumentException("history registration requires the original canonical ringing identity");
        }
        String month = YearMonth.from(call.createdAt().atZone(ZoneOffset.UTC)).toString();
        // All writes must succeed before the caller is allowed to claim authority.
        execute(insertRoom.bind(call.conversationId(), month, call.startedOrder(), call.callId()));
        execute(insertUser.bind(call.callerId(), month, call.startedOrder(), call.conversationId(), call.callId()));
        execute(insertUser.bind(call.calleeId(), month, call.startedOrder(), call.conversationId(), call.callId()));
    }

    @Override public List<Key> own(UUID actor, YearMonth month, Key after, int limit) {
        validate(actor, month, after, limit);
        var statement = after == null ? ownHead.bind(actor, month.toString(), limit)
                : ownAfter.bind(actor, month.toString(), after.startedOrder(), after.conversationId(), after.callId(), limit);
        return read(statement, null, limit);
    }
    @Override public List<Key> conversation(UUID room, YearMonth month, Key after, int limit) {
        validate(room, month, after, limit);
        if (after != null && !room.equals(after.conversationId())) throw new IllegalArgumentException("history cursor room mismatch");
        var statement = after == null ? roomHead.bind(room, month.toString(), limit)
                : roomAfter.bind(room, month.toString(), after.startedOrder(), after.callId(), limit);
        return read(statement, room, limit);
    }
    private List<Key> read(BoundStatement statement, UUID room, int limit) {
        var rows = execute(statement).iterator();
        var keys = new ArrayList<Key>();
        while (keys.size() < limit && rows.hasNext()) {
            Row row = rows.next();
            keys.add(new Key(row.getUuid("started_at"), room == null ? row.getUuid("conversation_id") : room, row.getUuid("call_id")));
        }
        return List.copyOf(keys);
    }
    private void validate(UUID scope, YearMonth month, Key after, int limit) {
        if (!id(scope) || month == null || limit < 1 || limit > 50) throw new IllegalArgumentException("invalid history partition or limit");
        if (after != null && (!id(after.conversationId()) || !id(after.callId()) || after.startedOrder() == null
                || after.startedOrder().version() != 1
                || !month.equals(YearMonth.from(Instant.ofEpochMilli(Uuids.unixTimestamp(after.startedOrder())).atZone(ZoneOffset.UTC))))) {
            throw new IllegalArgumentException("invalid history continuation key");
        }
    }
    private static boolean id(UUID id) { return id != null && !CallState.SLOT_ID.equals(id); }
    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM).setIdempotent(true));
    }
}
