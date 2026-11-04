package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore.ConversationProjectionCursor;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConversationProjectionPagingTest {
    CqlSession session;
    CanonicalCqlStore store;
    PreparedStatement sameTime, older, unpinned, canonical;
    final UUID actor = UUID.randomUUID(), after = UUID.randomUUID();
    final Instant activity = Instant.parse("2026-10-20T08:00:00Z");

    @BeforeEach void setup() {
        session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(mock(PreparedStatement.class));
        sameTime = mock(PreparedStatement.class); older = mock(PreparedStatement.class); unpinned = mock(PreparedStatement.class);
        canonical = mock(PreparedStatement.class);
        when(session.prepare(contains("last_activity_at = ? AND conversation_id > ?"))).thenReturn(sameTime);
        when(session.prepare(contains("AND last_activity_at < ?"))).thenReturn(older);
        when(session.prepare(contains("is_pinned = false LIMIT ?"))).thenReturn(unpinned);
        when(session.prepare("SELECT * FROM conversations_by_id WHERE conversation_id = ?")).thenReturn(canonical);
        store = new CanonicalCqlStore(session);
    }

    void result(PreparedStatement prepared, List<Row> rows, Object... args) {
        var bound = mock(BoundStatement.class);
        var result = mock(ResultSet.class);
        when(prepared.bind(args)).thenReturn(bound);
        when(session.execute(bound)).thenReturn(result);
        when(result.all()).thenReturn(rows);
    }

    Row row(boolean pinned, Instant at) {
        Row row = mock(Row.class);
        UUID room = UUID.randomUUID();
        when(row.getBoolean("is_pinned")).thenReturn(pinned);
        when(row.getInstant("last_activity_at")).thenReturn(at);
        when(row.getUuid("conversation_id")).thenReturn(room);
        // Missing canonical rooms still advance the raw cursor, never reappear as data.
        var canonicalQuery = mock(BoundStatement.class, RETURNS_SELF);
        var canonicalResult = mock(ResultSet.class);
        when(canonical.bind(room)).thenReturn(canonicalQuery);
        when(session.execute(canonicalQuery)).thenReturn(canonicalResult);
        return row;
    }

    @Test void sameTimeContinuationUsesAscendingIdAndStopsBeforeQueryingOlderRows() {
        var first = row(false, activity);
        var second = row(false, activity);
        result(sameTime, List.of(first, second, row(false, activity)), actor, false, activity, after, 3);
        var page = store.scanConversationProjectionByUser(actor, new ConversationProjectionCursor(false, activity, after), 2);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor().conversationId()).isEqualTo(second.getUuid("conversation_id"));
        assertThat(page.content()).isEmpty();
        verifyNoInteractions(older, unpinned);
    }

    @Test void fillsOnlyRemainingCapacityFromOlderActivityBeforeMovingToUnpinned() {
        var tie = row(true, activity);
        var previous = row(true, activity.minusSeconds(1));
        result(sameTime, List.of(tie), actor, true, activity, after, 3);
        result(older, List.of(previous), actor, true, activity, 2);
        result(unpinned, List.of(row(false, activity.plusSeconds(100))), actor, 1);
        var page = store.scanConversationProjectionByUser(actor, new ConversationProjectionCursor(true, activity, after), 2);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(new ConversationProjectionCursor(true,
                activity.minusSeconds(1), previous.getUuid("conversation_id")));
        var order = inOrder(sameTime, older, unpinned);
        order.verify(sameTime).bind(actor, true, activity, after, 3);
        order.verify(older).bind(actor, true, activity, 2);
        order.verify(unpinned).bind(actor, 1);
    }

    @Test void exhaustedUnpinnedCursorTerminatesWithoutRestartingThePartition() {
        result(sameTime, List.of(), actor, false, activity, after, 3);
        result(older, List.of(), actor, false, activity, 3);
        var page = store.scanConversationProjectionByUser(actor, new ConversationProjectionCursor(false, activity, after), 2);
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
        verifyNoInteractions(unpinned);
    }
}
