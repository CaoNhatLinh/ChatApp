package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.data.UdtValue;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class ConversationMessageDirectoryMoveTest {
    private final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    private final PreparedStatement loadCanonical = mock(PreparedStatement.class);
    private final PreparedStatement advanceCanonical = mock(PreparedStatement.class);
    private final PreparedStatement loadDirectory = mock(PreparedStatement.class);
    private final PreparedStatement deleteSource = mock(PreparedStatement.class);
    private final PreparedStatement insertTarget = mock(PreparedStatement.class);
    private final PreparedStatement updateSameKey = mock(PreparedStatement.class);
    private final BoundStatement delete = mock(BoundStatement.class, RETURNS_SELF);
    private final BoundStatement insert = mock(BoundStatement.class, RETURNS_SELF);
    private final BoundStatement update = mock(BoundStatement.class, RETURNS_SELF);
    private final ResultSet directory = mock(ResultSet.class);
    private final ResultSet outcome = mock(ResultSet.class);
    private final Row canonicalRow = mock(Row.class);
    private final UdtValue preview = mock(UdtValue.class, RETURNS_SELF);
    private final UUID actor = UUID.randomUUID();
    private final UUID room = UUID.randomUUID();
    private final UUID sender = UUID.randomUUID();
    private final Instant activity = Instant.parse("2026-10-23T08:00:00Z");
    private final Instant joinedAt = activity.minusSeconds(600);
    private final Set<UUID> roles = Set.of(UUID.randomUUID());
    private final UUID incomingId = Uuids.endOf(activity.toEpochMilli());
    private final CanonicalCqlStore store;

    ConversationMessageDirectoryMoveTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        var type = mock(UserDefinedType.class);
        var other = mock(PreparedStatement.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(type));
        when(type.newValue()).thenReturn(preview);
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            if (query.contains("SELECT conversation_type, last_message FROM conversations_by_id")) return loadCanonical;
            if (query.contains("SET last_message = ?, last_activity_at = ?")) return advanceCanonical;
            if (query.contains("SELECT * FROM conversations_by_user WHERE user_id = ? AND is_pinned IN (true, false)"))
                return loadDirectory;
            if (query.contains("DELETE FROM conversations_by_user") && query.contains("IF ")) return deleteSource;
            if (query.contains("INSERT INTO conversations_by_user") && query.contains("IF NOT EXISTS")) return insertTarget;
            if (query.contains("UPDATE conversations_by_user") && query.contains("SET last_message = ?")
                    && query.contains("unread_count = ?")) return updateSameKey;
            return other;
        });
        var canonicalRead = mock(BoundStatement.class, RETURNS_SELF);
        var canonicalWrite = mock(BoundStatement.class, RETURNS_SELF);
        var canonicalRows = mock(ResultSet.class);
        var canonicalOutcome = mock(ResultSet.class);
        when(loadCanonical.bind(room)).thenReturn(canonicalRead);
        when(session.execute(canonicalRead)).thenReturn(canonicalRows);
        when(canonicalRows.one()).thenReturn(canonicalRow);
        when(canonicalRow.getString("conversation_type")).thenReturn("GROUP");
        when(advanceCanonical.bind(preview, activity, room, "GROUP", null)).thenReturn(canonicalWrite);
        when(session.execute(canonicalWrite)).thenReturn(canonicalOutcome);
        when(canonicalOutcome.wasApplied()).thenReturn(true);
        var directoryRead = mock(BoundStatement.class, RETURNS_SELF);
        when(loadDirectory.bind(actor)).thenReturn(directoryRead);
        when(session.execute(directoryRead)).thenReturn(directory);
        when(deleteSource.bind(any(Object[].class))).thenReturn(delete);
        when(insertTarget.bind(any(Object[].class))).thenReturn(insert);
        when(updateSameKey.bind(any(Object[].class))).thenReturn(update);
        when(session.execute(update)).thenReturn(outcome);
        when(session.execute(any(BatchStatement.class))).thenReturn(outcome);
        store = new CanonicalCqlStore(session);
    }

    @Test
    void creatorStillAdvancesMemberDirectoryWhenRetryAlreadyRepairedRoomPointer() {
        var repairedPreview = lastMessage(incomingId);
        when(canonicalRow.getUdtValue("last_message")).thenReturn(repairedPreview);
        var oldPreview = lastMessage(Uuids.startOf(activity.toEpochMilli()));
        var oldRow = source(activity, oldPreview, 3);
        var movedRow = source(activity, repairedPreview, 4);
        when(directory.all()).thenReturn(List.of(oldRow), List.of(movedRow));
        when(outcome.wasApplied()).thenReturn(true);

        publishMessage();
        publishMessage();

        verifyNoInteractions(advanceCanonical);
        verify(updateSameKey).bind(repairedPreview, 4, actor, false, activity, room, joinedAt, oldPreview, 3);
        verify(session).execute(update);
    }

    @Test
    void movingToNewActivityUsesOneConditionalPartitionBatchWithNullableUnreadGuard() {
        Instant previousActivity = activity.minusSeconds(5);
        var oldPreview = lastMessage(Uuids.endOf(previousActivity.toEpochMilli()));
        var oldRow = source(previousActivity, oldPreview, null);
        when(directory.all()).thenReturn(List.of(oldRow));
        when(outcome.wasApplied()).thenReturn(true);

        publishMessage();

        var statement = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(statement.capture());
        assertThat(statement.getValue()).containsExactly(delete, insert);
        assertThat(statement.getValue().getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(statement.getValue().getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        assertThat(statement.getValue().getSerialConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_SERIAL);
        verify(deleteSource).bind(actor, false, previousActivity, room, joinedAt, oldPreview, null);
        verify(insertTarget).bind(actor, false, activity, room, "GROUP", "PRIVATE_LINK", roles, joinedAt, preview, 1, "MENTIONS");
        verifyNoInteractions(updateSameKey);
    }

    @Test
    void sameMillisecondNewerMessageUpdatesExistingKeyWithoutADelete() {
        var oldPreview = lastMessage(Uuids.startOf(activity.toEpochMilli()));
        var oldRow = source(activity, oldPreview, 3);
        when(directory.all()).thenReturn(List.of(oldRow));
        when(outcome.wasApplied()).thenReturn(true);

        publishMessage();

        verify(session).execute(update);
        verify(updateSameKey).bind(preview, 4, actor, false, activity, room, joinedAt, oldPreview, 3);
        verify(update).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(update).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        verifyNoInteractions(deleteSource, insertTarget);
    }

    @Test
    void directorySnapshotAlreadyNewerThanCandidateIsLeftAlone() {
        var newest = lastMessage(Uuids.startOf(activity.plusSeconds(5).toEpochMilli()));
        var newestRow = source(activity.plusSeconds(5), newest, 7);
        var equalRow = source(activity, lastMessage(incomingId), 7);
        when(directory.all()).thenReturn(List.of(newestRow), List.of(equalRow));

        publishMessage();
        publishMessage();

        verifyNoInteractions(deleteSource, insertTarget, updateSameKey);
    }

    @Test
    void failedMoveRereadsSourceAndStopsAfterThreeAttempts() {
        var oldPreview = lastMessage(Uuids.endOf(activity.minusSeconds(5).toEpochMilli()));
        Instant previousActivity = activity.minusSeconds(5);
        var oldRow = source(previousActivity, oldPreview, 3);
        var changedRow = source(previousActivity, oldPreview, 5);
        when(directory.all()).thenReturn(List.of(oldRow), List.of(changedRow));
        when(outcome.wasApplied()).thenReturn(false);

        publishMessage();

        verify(loadDirectory, times(3)).bind(actor);
        verify(session, times(3)).execute(any(BatchStatement.class));
        verify(deleteSource).bind(actor, false, previousActivity, room, joinedAt, oldPreview, 3);
        verify(deleteSource, times(2)).bind(actor, false, previousActivity, room, joinedAt, oldPreview, 5);
        verify(insertTarget).bind(actor, false, activity, room, "GROUP", "PRIVATE_LINK", roles, joinedAt, preview, 4, "MENTIONS");
        verify(insertTarget, times(2)).bind(actor, false, activity, room, "GROUP", "PRIVATE_LINK", roles, joinedAt, preview, 6, "MENTIONS");
    }

    @Test
    void directoryRowFromAnotherMembershipGenerationIsLeftAlone() {
        var oldRow = source(activity.minusSeconds(5), null, 0);
        when(oldRow.getInstant("joined_at")).thenReturn(joinedAt.plusSeconds(1));
        when(directory.all()).thenReturn(List.of(oldRow));

        publishMessage();

        verifyNoInteractions(deleteSource, insertTarget, updateSameKey);
    }

    private void publishMessage() {
        var message = mock(CanonicalMessage.class);
        when(message.conversationId()).thenReturn(room);
        when(message.messageId()).thenReturn(incomingId);
        when(message.senderId()).thenReturn(sender);
        when(message.messageBucket()).thenReturn("2026-10-23-08:03");
        when(message.createdAt()).thenReturn(activity);
        var member = new ConversationMember(room, actor, roles, joinedAt, null, null, null, "MENTIONS", null, null);
        store.updateLastMessageProjections(message, "Sender", List.of(member));
    }

    private UdtValue lastMessage(UUID id) {
        var summary = mock(UdtValue.class);
        when(summary.getUuid("message_id")).thenReturn(id);
        return summary;
    }

    private Row source(Instant sourceActivity, UdtValue lastMessage, Integer unread) {
        var row = mock(Row.class);
        when(row.getUuid("conversation_id")).thenReturn(room);
        when(row.getInstant("last_activity_at")).thenReturn(sourceActivity);
        when(row.getInstant("joined_at")).thenReturn(joinedAt);
        when(row.getUdtValue("last_message")).thenReturn(lastMessage);
        when(row.getString("conversation_type")).thenReturn("GROUP");
        when(row.getString("visibility")).thenReturn("PRIVATE_LINK");
        when(row.getSet("role_ids", UUID.class)).thenReturn(roles);
        when(row.getString("notification_override")).thenReturn("MENTIONS");
        when(row.isNull("unread_count")).thenReturn(unread == null);
        when(row.getInt("unread_count")).thenReturn(unread == null ? 0 : unread);
        return row;
    }
}
