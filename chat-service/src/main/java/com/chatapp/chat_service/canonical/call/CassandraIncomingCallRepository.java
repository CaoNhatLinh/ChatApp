package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class CassandraIncomingCallRepository implements IncomingCallRepository {
    private final CqlSession session;
    private final PreparedStatement register, page, pageAfter;

    public CassandraIncomingCallRepository(CqlSession session) {
        this.session = session;
        register = session.prepare("INSERT INTO incoming_calls_by_user (callee_id,ring_deadline,conversation_id,call_id) VALUES (?,?,?,?)");
        String select = "SELECT ring_deadline,conversation_id,call_id FROM incoming_calls_by_user WHERE callee_id=?";
        page = session.prepare(select + " AND ring_deadline>? LIMIT ?");
        pageAfter = session.prepare(select + " AND (ring_deadline,conversation_id,call_id) > (?,?,?) LIMIT ?");
    }

    @Override public void register(CallState call) {
        if (call == null || call.status() != CallState.Status.RINGING || call.version() != 1) {
            throw new IllegalArgumentException("only a new ringing call can register incoming discovery");
        }
        execute(register.bind(call.calleeId(), call.deadline(), call.conversationId(), call.callId()));
    }

    @Override public List<Key> page(UUID callee, Instant since, Key after, int limit) {
        if (limit < 1 || limit > 50) throw new IllegalArgumentException("bounded incoming call page is required");
        BoundStatement statement = after == null ? page.bind(callee, since, limit)
                : pageAfter.bind(callee, after.deadline(), after.conversationId(), after.callId(), limit);
        var keys = new ArrayList<Key>();
        for (Row row : execute(statement)) {
            keys.add(new Key(row.getInstant("ring_deadline"), row.getUuid("conversation_id"), row.getUuid("call_id")));
        }
        return List.copyOf(keys);
    }

    private ResultSet execute(BoundStatement statement) {
        return session.execute(statement.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM).setIdempotent(true));
    }
}
