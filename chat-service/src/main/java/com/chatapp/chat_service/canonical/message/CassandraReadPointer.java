package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import java.time.Instant;
import java.util.UUID;

/** CAS is confined to the membership partition, never a conditional cross-partition batch. */
final class CassandraReadPointer {
    private final CqlSession session;
    private final PreparedStatement load;
    private final PreparedStatement advance;

    CassandraReadPointer(CqlSession session) {
        this.session = session;
        load = session.prepare("""
                SELECT last_read_message_id, joined_at FROM conversation_members_by_conversation
                WHERE conversation_id = ? AND user_id = ?
                """);
        advance = session.prepare("""
                UPDATE conversation_members_by_conversation SET last_read_message_id = ?, last_read_at = ?
                WHERE conversation_id = ? AND user_id = ?
                IF last_read_message_id = ? AND joined_at = ?
                """);
    }

    boolean advance(UUID conversationId, UUID readerId, UUID messageId, Instant readAt) {
        for (int attempt = 0; attempt < 4; attempt++) {
            Row current = session.execute(load.bind(conversationId, readerId)).one();
            if (current == null || current.getInstant("joined_at") == null) return false;
            UUID previous = current.getUuid("last_read_message_id");
            if (previous != null) {
                int order = MessageOrder.compare(previous, messageId);
                if (order > 0) return false;
                // A retry after pointer CAS may still need to repair the receipt batch.
                if (order == 0) return true;
            }
            if (session.execute(advance.bind(messageId, readAt, conversationId, readerId,
                    previous, current.getInstant("joined_at"))).wasApplied()) return true;
        }
        throw new ConflictException("read position changed concurrently; retry the request");
    }
}
