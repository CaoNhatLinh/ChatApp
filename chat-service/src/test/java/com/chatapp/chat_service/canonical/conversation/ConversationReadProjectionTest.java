package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.data.UdtValue;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

class ConversationReadProjectionTest {
    @Test void chatPolicyUsesConditionalWritesForObservedAndCurrentMembers() {
        CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        var observedUpdate = mock(PreparedStatement.class);
        var currentUpdate = mock(PreparedStatement.class);
        var other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("IF joined_at = ? AND muted_until = ? AND message_interval_seconds = ? AND owner_id = ?"))).thenReturn(observedUpdate);
        when(session.prepare(argThat((String sql) -> sql != null && sql.contains("SET muted_until = ?, message_interval_seconds = ?")
                && sql.contains("IF EXISTS")))).thenReturn(currentUpdate);
        var store = new CanonicalCqlStore(session);
        var room = UUID.randomUUID();
        var user = UUID.randomUUID();
        var owner = UUID.randomUUID();
        var joinedAt = Instant.EPOCH;
        var mutedUntil = Instant.parse("2026-10-20T08:00:00Z");
        var member = new CanonicalConversationMember(room, user, Set.of(), joinedAt, null, null, null, "ALL", null, null);
        var observedWrite = mock(BoundStatement.class, RETURNS_SELF);
        var currentWrite = mock(BoundStatement.class, RETURNS_SELF);
        when(observedUpdate.bind(mutedUntil, 120, room, user, joinedAt, null, null, owner)).thenReturn(observedWrite);
        when(currentUpdate.bind(mutedUntil, null, room, user)).thenReturn(currentWrite);
        var rejected = mock(ResultSet.class);
        when(session.execute(observedWrite)).thenReturn(rejected);

        assertThat(store.updateObservedMemberChatPolicy(member, owner, mutedUntil, 120)).isFalse();
        assertThat(store.updateObservedMemberChatPolicy(member, user, mutedUntil, 120)).isFalse();
        store.updateMemberChatPolicy(room, user, mutedUntil, null);
        verify(session).execute(currentWrite);
        verify(observedWrite).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        verify(currentWrite).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }

    @Test void notificationUpdateChecksTheObservedMembershipAndOverride() {
        CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        var update = mock(PreparedStatement.class);
        var other = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("IF joined_at = ? AND notification_override = ?"))).thenReturn(update);
        var store = new CanonicalCqlStore(session);
        var room = UUID.randomUUID();
        var user = UUID.randomUUID();
        var joinedAt = Instant.parse("2026-10-20T08:00:00Z");
        var observed = new CanonicalConversationMember(room, user, Set.of(), joinedAt, null, null, null, "ALL", null, null);
        var write = mock(BoundStatement.class, RETURNS_SELF);
        when(update.bind("NONE", room, user, joinedAt, "ALL")).thenReturn(write);
        var result = mock(ResultSet.class);
        when(session.execute(write)).thenReturn(result);
        when(result.wasApplied()).thenReturn(false, true);

        assertThat(store.updateMemberNotificationPolicy(observed, "NONE")).isFalse();
        assertThat(store.updateMemberNotificationPolicy(observed, "NONE")).isTrue();
        verify(write, times(2)).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(write, times(2)).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
    }

    @Test void pointReadBindsExactActivityAndResolvesDuplicateRowsFromPinAuthority() {
        CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        PreparedStatement other = mock(PreparedStatement.class), load = mock(PreparedStatement.class);
        var loadCanonical = mock(PreparedStatement.class);
        var loadPinSlots = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("is_pinned IN (true, false) AND last_activity_at = ?"))).thenReturn(load);
        when(session.prepare("SELECT * FROM conversations_by_id WHERE conversation_id = ?")).thenReturn(loadCanonical);
        when(session.prepare(contains("SELECT * FROM pinned_conversation_slots_by_user WHERE user_id = ?"))).thenReturn(loadPinSlots);
        var store = spy(new CanonicalCqlStore(session));
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
        Instant activity = Instant.parse("2026-10-20T08:00:00Z");
        var conversation = mock(CanonicalConversation.class);
        when(conversation.conversationId()).thenReturn(room);
        when(conversation.lastActivityAt()).thenReturn(activity);
        doReturn(new CanonicalCqlStore.MembershipState(1, 5, actor, activity, 0L))
                .when(store).requireMembershipState(room);
        BoundStatement query = mock(BoundStatement.class);
        ResultSet result = mock(ResultSet.class);
        when(load.bind(actor, activity, room)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        Row row = mock(Row.class);
        when(row.getUuid("conversation_id")).thenReturn(room);
        when(row.getBoolean("is_pinned")).thenReturn(true);
        when(row.getInt("unread_count")).thenReturn(9);
        UdtValue staleDirectoryPreview = mock(UdtValue.class);
        when(staleDirectoryPreview.getUuid("message_id")).thenReturn(Uuids.startOf(activity.minusSeconds(1).toEpochMilli()));
        when(staleDirectoryPreview.getString("message_bucket")).thenReturn("2026-10-20-07:10");
        when(row.getUdtValue("last_message")).thenReturn(staleDirectoryPreview);
        when(row.getInstant("last_activity_at")).thenReturn(activity);
        var canonicalQuery = mock(BoundStatement.class, RETURNS_SELF);
        var canonicalResult = mock(ResultSet.class);
        var canonicalRow = mock(Row.class);
        var latestPreview = mock(UdtValue.class);
        UUID latestMessageId = Uuids.startOf(activity.toEpochMilli());
        when(latestPreview.getUuid("message_id")).thenReturn(latestMessageId);
        when(latestPreview.getString("message_bucket")).thenReturn("2026-10-20-08:09");
        when(canonicalRow.getUuid("conversation_id")).thenReturn(room);
        when(canonicalRow.getInstant("last_activity_at")).thenReturn(activity);
        when(canonicalRow.getInstant("updated_at")).thenReturn(activity);
        when(canonicalRow.getUdtValue("last_message")).thenReturn(latestPreview);
        when(canonicalRow.getObject("last_message")).thenReturn(latestPreview);
        when(loadCanonical.bind(room)).thenReturn(canonicalQuery);
        when(session.execute(canonicalQuery)).thenReturn(canonicalResult);
        when(canonicalResult.one()).thenReturn(canonicalRow);
        var pinQuery = mock(BoundStatement.class, RETURNS_SELF);
        var pinResult = mock(ResultSet.class);
        var slot = mock(Row.class);
        when(slot.getUuid("conversation_id")).thenReturn(room);
        when(loadPinSlots.bind(actor)).thenReturn(pinQuery);
        when(session.execute(pinQuery)).thenReturn(pinResult);
        when(pinResult.all()).thenReturn(List.of(slot), List.of(), List.of(), List.of(slot));
        when(result.iterator()).thenAnswer(invocation -> List.of(row).iterator());
        var summary = store.findConversationProjectionAtActivity(actor, conversation);
        assertThat(summary.pinned()).isTrue();
        assertThat(summary.unreadCount()).isEqualTo(9);
        assertThat(summary.conversation().conversationId()).isEqualTo(room);
        assertThat(summary.lastActivityAt()).isEqualTo(activity);
        assertThat(summary.lastMessage().messageId()).isEqualTo(latestMessageId);
        assertThat(summary.lastMessage().messageBucket()).isEqualTo("2026-10-20-08:09");
        when(row.getUdtValue("last_message")).thenReturn((UdtValue) null);
        var stalePinnedRow = store.findConversationProjectionAtActivity(actor, conversation);
        assertThat(stalePinnedRow.pinned()).isFalse();
        assertThat(stalePinnedRow.lastMessage()).isEqualTo(summary.lastMessage());
        Row unpinned = mock(Row.class);
        when(unpinned.getUuid("conversation_id")).thenReturn(room);
        when(unpinned.getInt("unread_count")).thenReturn(4);
        when(result.iterator()).thenAnswer(invocation -> List.of(row, unpinned).iterator());
        var beforePin = store.findConversationProjectionAtActivity(actor, conversation);
        assertThat(beforePin.pinned()).isFalse();
        assertThat(beforePin.unreadCount()).isEqualTo(4);
        assertThat(store.findConversationProjectionAtActivity(actor, conversation).pinned()).isTrue();
        when(result.iterator()).thenAnswer(invocation -> Collections.<Row>emptyIterator());
        assertThat(store.findConversationProjectionAtActivity(actor, conversation)).isNull();
        verify(load, times(5)).bind(actor, activity, room);
        verify(loadCanonical, times(4)).bind(room);
        verify(loadPinSlots, times(4)).bind(actor);
        verify(other, never()).bind(any(Object[].class));
    }

    @Test void previewWriterInitializesNullSummaryWithTheExactClaimedBucket() {
        var writer = new PreviewWriter();
        var first = writer.message(Uuids.startOf(writer.createdAt.toEpochMilli()));
        var empty = writer.row(null);
        when(writer.current.one()).thenReturn(empty);
        when(writer.outcome.wasApplied()).thenReturn(true);

        writer.store.updateLastMessageProjections(first, "Sender", List.of());

        verify(writer.summary).setString("message_bucket", "2026-10-23-08:09");
        verify(writer.update).bind(writer.summary, writer.createdAt, writer.room, "GROUP", null);
        verify(writer.readStatement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(writer.writeStatement).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(writer.writeStatement).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        verify(writer.session).prepare(argThat((String query) -> query.contains("SET last_message = ?, last_activity_at = ?")
                && query.contains("IF conversation_type = ? AND last_message = ?")
                && !query.contains("updated_at") && !query.contains("is_deleted")));
    }

    @Test void previewWriterKeepsNewerSameMillisecondMessageWhenOlderSendFinishesLate() {
        var writer = new PreviewWriter();
        UUID older = Uuids.startOf(writer.createdAt.toEpochMilli());
        UUID newer = Uuids.endOf(writer.createdAt.toEpochMilli());
        var latest = writer.row(writer.previous(newer));
        when(writer.current.one()).thenReturn(latest);
        var member = mock(ConversationMember.class);

        writer.store.updateLastMessageProjections(writer.message(older), "Sender", List.of(member));

        verifyNoInteractions(writer.update);
        verifyNoInteractions(member);
    }

    @Test void previewWriterRereadsAfterCasLossAndStopsWhenNewerMessageAlreadyWon() {
        var writer = new PreviewWriter();
        UUID incoming = Uuids.startOf(writer.createdAt.toEpochMilli());
        var empty = writer.row(null);
        var latest = writer.row(writer.previous(Uuids.endOf(writer.createdAt.toEpochMilli())));
        when(writer.current.one()).thenReturn(empty, latest);
        when(writer.outcome.wasApplied()).thenReturn(false);
        var member = mock(ConversationMember.class);

        writer.store.updateLastMessageProjections(writer.message(incoming), "Sender", List.of(member));

        verify(writer.session, times(2)).execute(writer.readStatement);
        verify(writer.session).execute(writer.writeStatement);
        verify(writer.update).bind(writer.summary, writer.createdAt, writer.room, "GROUP", null);
        verifyNoInteractions(member);
    }

    @Test void previewWriterRetriesAgainstTheExactSummaryWhenAnOlderMessageWonTheCas() {
        var writer = new PreviewWriter();
        UUID incoming = Uuids.endOf(writer.createdAt.toEpochMilli());
        var previous = writer.previous(Uuids.startOf(writer.createdAt.toEpochMilli()));
        var empty = writer.row(null);
        var latest = writer.row(previous);
        when(writer.current.one()).thenReturn(empty, latest);
        when(writer.outcome.wasApplied()).thenReturn(false, true);

        writer.store.updateLastMessageProjections(writer.message(incoming), "Sender", List.of());

        var attempts = inOrder(writer.update);
        attempts.verify(writer.update).bind(writer.summary, writer.createdAt, writer.room, "GROUP", null);
        attempts.verify(writer.update).bind(writer.summary, writer.createdAt, writer.room, "GROUP", previous);
    }

    @Test void previewWriterDoesNotCreateAMissingCanonicalConversation() {
        var writer = new PreviewWriter();
        when(writer.current.one()).thenReturn((Row) null);

        writer.store.updateLastMessageProjections(writer.message(Uuids.timeBased()), "Sender", List.of());

        verifyNoInteractions(writer.update);
    }

    @Test void previewContentionRemainsBoundedAndDoesNotFailTheCommittedSend() {
        var writer = new PreviewWriter();
        var empty = writer.row(null);
        var member = mock(ConversationMember.class);
        when(writer.current.one()).thenReturn(empty);
        when(writer.outcome.wasApplied()).thenReturn(false);

        writer.store.updateLastMessageProjections(writer.message(Uuids.timeBased()), "Sender", List.of(member));

        verify(writer.session, times(5)).execute(writer.readStatement);
        verify(writer.session, times(4)).execute(writer.writeStatement);
        verifyNoInteractions(member);
    }

    @Test void repairsOnlyTheCoveredExactProjectionWithoutScanningOrRecreatingMovedRows() {
        CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        PreparedStatement other = mock(PreparedStatement.class), load = mock(PreparedStatement.class), clear = mock(PreparedStatement.class);
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("is_pinned IN (true, false) AND last_activity_at = ?"))).thenReturn(load);
        when(session.prepare(contains("IF last_message = ?"))).thenReturn(clear);
        var store = spy(new CanonicalCqlStore(session));
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), readId = Uuids.startOf(2000);
        Instant activity = Instant.parse("2026-10-20T08:00:00Z");
        var conversation = mock(CanonicalConversation.class);
        when(conversation.lastActivityAt()).thenReturn(activity);
        doReturn(conversation).when(store).findConversation(room);
        BoundStatement query = mock(BoundStatement.class), update = mock(BoundStatement.class, RETURNS_SELF);
        ResultSet result = mock(ResultSet.class);
        when(load.bind(actor, activity, room)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        Row covered = mock(Row.class), newer = mock(Row.class), rejoined = mock(Row.class);
        UdtValue oldSummary = mock(UdtValue.class), newerSummary = mock(UdtValue.class);
        when(covered.getUdtValue("last_message")).thenReturn(oldSummary);
        when(newer.getUdtValue("last_message")).thenReturn(newerSummary);
        when(oldSummary.getUuid("message_id")).thenReturn(Uuids.startOf(1000));
        when(newerSummary.getUuid("message_id")).thenReturn(Uuids.startOf(3000));
        when(covered.getInstant("last_activity_at")).thenReturn(activity);
        when(covered.getInstant("joined_at")).thenReturn(activity);
        when(newer.getInstant("joined_at")).thenReturn(activity);
        when(rejoined.getInstant("joined_at")).thenReturn(activity.plusSeconds(1));
        when(result.iterator()).thenAnswer(invocation -> List.of(covered, newer, rejoined).iterator());
        when(clear.bind(actor, false, activity, room, oldSummary, activity)).thenReturn(update);
        store.clearReadConversationProjection(actor, room, readId, activity);
        verify(load).bind(actor, activity, room);
        verify(clear).bind(actor, false, activity, room, oldSummary, activity);
        verify(clear, times(1)).bind(any(Object[].class));
        verify(session).execute(update);
        verify(other, never()).bind(any(Object[].class));
    }

    private static final class PreviewWriter {
        final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
        final PreparedStatement update = mock(PreparedStatement.class);
        final BoundStatement readStatement = mock(BoundStatement.class, RETURNS_SELF);
        final BoundStatement writeStatement = mock(BoundStatement.class, RETURNS_SELF);
        final ResultSet current = mock(ResultSet.class);
        final ResultSet outcome = mock(ResultSet.class);
        final UdtValue summary = mock(UdtValue.class, RETURNS_SELF);
        final UUID room = UUID.randomUUID();
        final Instant createdAt = Instant.parse("2026-10-23T08:09:00Z");
        final CanonicalCqlStore store;

        PreviewWriter() {
            var keyspace = mock(com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata.class);
            var type = mock(UserDefinedType.class);
            var load = mock(PreparedStatement.class);
            when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
            when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(type));
            when(type.newValue()).thenReturn(summary);
            when(session.prepare(contains("SELECT conversation_type, last_message FROM conversations_by_id"))).thenReturn(load);
            when(session.prepare(contains("SET last_message = ?, last_activity_at = ?"))).thenReturn(update);
            when(load.bind(room)).thenReturn(readStatement);
            when(update.bind(eq(summary), eq(createdAt), eq(room), eq("GROUP"), nullable(UdtValue.class))).thenReturn(writeStatement);
            when(session.execute(readStatement)).thenReturn(current);
            when(session.execute(writeStatement)).thenReturn(outcome);
            store = new CanonicalCqlStore(session);
        }

        Row row(UdtValue previous) {
            var row = mock(Row.class);
            when(row.getString("conversation_type")).thenReturn("GROUP");
            when(row.getUdtValue("last_message")).thenReturn(previous);
            return row;
        }

        UdtValue previous(UUID id) {
            var value = mock(UdtValue.class);
            when(value.getUuid("message_id")).thenReturn(id);
            return value;
        }

        CanonicalMessage message(UUID id) {
            var message = mock(CanonicalMessage.class);
            when(message.conversationId()).thenReturn(room);
            when(message.messageId()).thenReturn(id);
            when(message.createdAt()).thenReturn(createdAt);
            when(message.messageBucket()).thenReturn("2026-10-23-08:09");
            return message;
        }
    }
}
