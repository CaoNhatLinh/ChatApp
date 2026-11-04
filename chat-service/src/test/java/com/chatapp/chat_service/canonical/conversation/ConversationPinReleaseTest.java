package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.ConflictException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

class ConversationPinReleaseTest {
    private final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    private final PreparedStatement readSlots = mock(PreparedStatement.class);
    private final PreparedStatement releaseSlot = mock(PreparedStatement.class);
    private final PreparedStatement claimSlot = mock(PreparedStatement.class);
    private final PreparedStatement readPinnedDirectory = mock(PreparedStatement.class);
    private final PreparedStatement readAnyDirectory = mock(PreparedStatement.class);
    private final PreparedStatement readExactDirectory = mock(PreparedStatement.class);
    private final PreparedStatement readMembership = mock(PreparedStatement.class);
    private final PreparedStatement readCanonical = mock(PreparedStatement.class);
    private final PreparedStatement removeDirectory = mock(PreparedStatement.class);
    private final PreparedStatement saveDirectory = mock(PreparedStatement.class);
    private final BoundStatement read = mock(BoundStatement.class, RETURNS_SELF);
    private final BoundStatement release = mock(BoundStatement.class, RETURNS_SELF);
    private final ResultSet slots = mock(ResultSet.class);
    private final ResultSet released = mock(ResultSet.class);
    private final Row observed = mock(Row.class);
    private final UUID actor = UUID.randomUUID();
    private final UUID room = UUID.randomUUID();
    private final UUID generation = Uuids.timeBased();
    private final Instant activity = Instant.parse("2026-10-23T08:00:00Z");
    private final Instant joinedAt = activity.minusSeconds(100);
    private final Set<UUID> roles = Set.of(UUID.randomUUID());
    private final CanonicalCqlStore store;

    ConversationPinReleaseTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(mock(PreparedStatement.class));
        when(session.prepare(contains("SELECT * FROM pinned_conversation_slots_by_user"))).thenReturn(readSlots);
        when(session.prepare(contains("DELETE FROM pinned_conversation_slots_by_user"))).thenReturn(releaseSlot);
        when(session.prepare(contains("INSERT INTO pinned_conversation_slots_by_user"))).thenReturn(claimSlot);
        when(session.prepare(argThat((String query) -> query != null && query.contains("WHERE user_id = ? AND is_pinned = true")
                && !query.contains("LIMIT")))).thenReturn(readPinnedDirectory);
        when(session.prepare(contains("SELECT * FROM conversations_by_user WHERE user_id = ? AND is_pinned IN (true, false)")))
                .thenReturn(readAnyDirectory);
        when(session.prepare(contains("is_pinned IN (true, false) AND last_activity_at = ? AND conversation_id = ?")))
                .thenReturn(readExactDirectory);
        when(session.prepare(contains("SELECT * FROM conversation_members_by_conversation\nWHERE conversation_id = ? AND user_id = ?")))
                .thenReturn(readMembership);
        when(session.prepare("SELECT * FROM conversations_by_id WHERE conversation_id = ?")).thenReturn(readCanonical);
        when(session.prepare(argThat((String query) -> query != null && query.contains("DELETE FROM conversations_by_user")
                && query.contains("IF joined_at = ? AND last_message = ? AND unread_count = ?")))).thenReturn(removeDirectory);
        when(session.prepare(argThat((String query) -> query != null && query.contains("INSERT INTO conversations_by_user")
                && query.contains("IF NOT EXISTS")))).thenReturn(saveDirectory);
        when(readSlots.bind(actor)).thenReturn(read);
        when(session.execute(read)).thenReturn(slots);
        when(observed.getUuid("conversation_id")).thenReturn(room);
        when(observed.getUuid("pinned_at")).thenReturn(generation);
        when(observed.getByte("pin_slot")).thenReturn((byte) 1);
        when(slots.all()).thenReturn(List.of(observed));
        when(releaseSlot.bind(actor, (byte) 1, room, generation)).thenReturn(release);
        when(session.execute(release)).thenReturn(released);
        store = new CanonicalCqlStore(session);
    }

    @Test
    void staleUnpinDoesNotReleaseReplacementOrMoveDirectory() {
        when(released.wasApplied()).thenReturn(false);

        assertThatThrownBy(() -> store.unpinConversation(actor, room)).isInstanceOf(ConflictException.class);

        verify(session).prepare(argThat((String query) -> query.contains("DELETE FROM pinned_conversation_slots_by_user")
                && query.contains("IF conversation_id = ? AND pinned_at = ?")));
        verify(readSlots).bind(actor);
        verify(read).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(releaseSlot).bind(actor, (byte) 1, room, generation);
        verify(release).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(release).setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL);
        verifyNoInteractions(readPinnedDirectory, removeDirectory, saveDirectory);
    }

    @Test
    void successfulReleaseMovesOnlyTheMatchingDirectoryRowAndReportsSuccess() {
        when(released.wasApplied()).thenReturn(true);
        when(slots.all()).thenReturn(List.of(observed), List.of());
        var move = directoryMove(true, readPinnedDirectory, true);

        assertThat(store.unpinConversation(actor, room)).isTrue();

        var order = inOrder(session);
        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        order.verify(session).execute(release);
        order.verify(session).execute(move.read());
        order.verify(session).execute(batch.capture());
        assertMove(batch.getValue(), move);
    }

    @Test
    void successfulPinMovesOnlyTheMatchingDirectoryRowAndReportsSuccess() {
        var claim = mock(BoundStatement.class, RETURNS_SELF);
        var claimed = mock(ResultSet.class);
        when(claimSlot.bind(actor, (byte) 1, room)).thenReturn(claim);
        when(session.execute(claim)).thenReturn(claimed);
        when(claimed.wasApplied()).thenReturn(true);
        when(slots.all()).thenReturn(List.of(), List.of(observed));
        var move = directoryMove(false, readAnyDirectory, true);

        assertThat(store.tryPinConversation(actor, room, 1)).isEqualTo(CanonicalCqlStore.ConversationPinResult.PINNED);

        var order = inOrder(session);
        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        order.verify(session).execute(move.read());
        order.verify(session).execute(claim);
        order.verify(session).execute(batch.capture());
        assertMove(batch.getValue(), move);
    }

    @Test
    void directoryCasContentionDoesNotEraseSuccessfulSlotRelease() {
        when(released.wasApplied()).thenReturn(true);
        when(slots.all()).thenReturn(List.of(observed), List.of());
        var move = directoryMove(true, readPinnedDirectory, false);

        assertThat(store.unpinConversation(actor, room)).isTrue();

        verify(session, times(3)).execute(move.read());
        verify(session, times(3)).execute(any(BatchStatement.class));
    }

    @Test
    void successfulReleaseDoesNotMoveDirectoryAfterConcurrentRepin() {
        when(released.wasApplied()).thenReturn(true);
        directoryMove(true, readPinnedDirectory, true);

        assertThat(store.unpinConversation(actor, room)).isTrue();

        verify(readSlots, times(2)).bind(actor);
        verifyNoInteractions(removeDirectory, saveDirectory);
    }

    @Test
    void absentSlotNeverIssuesRelease() {
        var directoryRead = mock(BoundStatement.class);
        var directoryResult = mock(ResultSet.class);
        when(readPinnedDirectory.bind(actor)).thenReturn(directoryRead);
        when(session.execute(directoryRead)).thenReturn(directoryResult);
        when(directoryResult.all()).thenReturn(List.of());

        assertThat(store.unpinConversation(actor, UUID.randomUUID())).isFalse();

        verifyNoInteractions(releaseSlot, removeDirectory, saveDirectory);
    }

    @Test
    void repeatingUnpinRepairsStaleDirectoryWithoutReportingAnotherSlotRelease() {
        when(slots.all()).thenReturn(List.of());
        var move = directoryMove(true, readPinnedDirectory, true);

        assertThat(store.unpinConversation(actor, room)).isFalse();

        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(batch.capture());
        assertMove(batch.getValue(), move);
        verifyNoInteractions(releaseSlot);
    }

    @Test
    void repeatingUnpinDoesNotMoveDirectoryWhenAPinReappears() {
        when(slots.all()).thenReturn(List.of(), List.of(observed));
        directoryMove(true, readPinnedDirectory, true);

        assertThat(store.unpinConversation(actor, room)).isFalse();

        verify(readSlots, times(2)).bind(actor);
        verifyNoInteractions(releaseSlot, removeDirectory, saveDirectory);
    }

    @Test
    void missingGenerationCannotFallBackToAnUnfencedRelease() {
        when(observed.getUuid("pinned_at")).thenReturn(null);

        assertThatThrownBy(() -> store.unpinConversation(actor, room)).isInstanceOf(IllegalStateException.class);

        verifyNoInteractions(releaseSlot, readPinnedDirectory, removeDirectory, saveDirectory);
    }

    @Test
    void readRepairMovesOnlyAnObservedExactRowAfterMembershipAndPinRechecks() {
        var move = directoryMove(false, readExactDirectory, true, actor, activity, room);
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt);
        var membership = membershipLookup(member);

        store.repairConversationProjectionPin(actor, observedProjection(false), true);

        var order = inOrder(session);
        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        order.verify(session).execute(move.read());
        order.verify(session).execute(membership);
        order.verify(session).execute(read);
        order.verify(session).execute(batch.capture());
        assertMove(batch.getValue(), move);
        verifyNoInteractions(readAnyDirectory, readPinnedDirectory, claimSlot, releaseSlot);
    }

    @Test
    void readRepairSkipsWhenObservedMembershipHasBeenReplaced() {
        directoryMove(false, readExactDirectory, true, actor, activity, room);
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt.plusSeconds(1));
        membershipLookup(member);

        store.repairConversationProjectionPin(actor, observedProjection(false), true);

        verifyNoInteractions(readSlots, removeDirectory, saveDirectory);
    }

    @Test
    void readRepairSkipsWhenSlotNoLongerSupportsDestinationPlane() {
        directoryMove(false, readExactDirectory, true, actor, activity, room);
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt);
        membershipLookup(member);
        when(slots.all()).thenReturn(List.of());

        store.repairConversationProjectionPin(actor, observedProjection(false), true);

        verify(readSlots).bind(actor);
        verifyNoInteractions(removeDirectory, saveDirectory);
    }

    @Test
    void activityRepairUsesExactPreviousKeyAndZeroOnlyWhenLatestIsCovered() {
        Instant oldActivity = activity.minusSeconds(30);
        UUID latestId = Uuids.endOf(activity.toEpochMilli());
        var latest = canonicalPreview(latestId, activity);
        var previous = activitySource(oldActivity);
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt);
        when(member.getUuid("last_read_message_id")).thenReturn(latestId);
        membershipLookup(member);
        projectionPlanes(activity, List.of());
        var delete = mock(BoundStatement.class);
        var insert = mock(BoundStatement.class);
        when(removeDirectory.bind(actor, false, oldActivity, room, joinedAt, previous, 8)).thenReturn(delete);
        when(saveDirectory.bind(actor, true, activity, room, "GROUP", "PRIVATE_LINK", roles, joinedAt, latest, 0, "MENTIONS"))
                .thenReturn(insert);
        when(session.execute(any(BatchStatement.class))).thenReturn(mock(ResultSet.class));

        store.repairConversationProjectionActivity(actor, observedProjection(false, oldActivity), true);

        var batch = ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(batch.capture());
        assertThat(batch.getValue()).containsExactly(delete, insert);
        verify(readExactDirectory).bind(actor, oldActivity, room);
        verify(readExactDirectory).bind(actor, activity, room);
        verify(readCanonical).bind(room);
        verify(readMembership).bind(room, actor);
        verify(readSlots).bind(actor);
    }

    @Test
    void activityRepairDoesNotInventAnUnreadCountWhenLatestIsNotCovered() {
        Instant oldActivity = activity.minusSeconds(30);
        canonicalPreview(Uuids.endOf(activity.toEpochMilli()), activity);
        activitySource(oldActivity);
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt);
        when(member.getUuid("last_read_message_id")).thenReturn(Uuids.startOf(activity.toEpochMilli()));
        membershipLookup(member);

        store.repairConversationProjectionActivity(actor, observedProjection(false, oldActivity), true);

        verifyNoInteractions(readSlots, removeDirectory, saveDirectory);
    }

    @Test
    void activityRepairLeavesRowAloneIfCanonicalActivityChangedSinceListing() {
        canonicalPreview(Uuids.startOf(activity.plusSeconds(5).toEpochMilli()), activity.plusSeconds(5));

        store.repairConversationProjectionActivity(actor, observedProjection(false, activity.minusSeconds(30)), true);

        verifyNoInteractions(readExactDirectory, readMembership, readSlots, removeDirectory, saveDirectory);
    }

    @Test
    void activityRepairNeverReplacesANewerSourcePreview() {
        Instant oldActivity = activity.minusSeconds(30);
        UUID latestId = Uuids.startOf(activity.toEpochMilli());
        canonicalPreview(latestId, activity);
        activitySource(oldActivity, Uuids.endOf(activity.toEpochMilli()));
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt);
        when(member.getUuid("last_read_message_id")).thenReturn(latestId);
        membershipLookup(member);

        store.repairConversationProjectionActivity(actor, observedProjection(false, oldActivity), true);

        verifyNoInteractions(readSlots, removeDirectory, saveDirectory);
    }

    @Test
    void activityRepairDoesNotDuplicateACurrentRowInTheOtherPinPlane() {
        Instant oldActivity = activity.minusSeconds(30);
        UUID latestId = Uuids.endOf(activity.toEpochMilli());
        canonicalPreview(latestId, activity);
        activitySource(oldActivity);
        var member = mock(Row.class);
        when(member.getInstant("joined_at")).thenReturn(joinedAt);
        when(member.getUuid("last_read_message_id")).thenReturn(latestId);
        membershipLookup(member);
        var destination = mock(Row.class);
        when(destination.getBoolean("is_pinned")).thenReturn(false);
        projectionPlanes(activity, List.of(destination));

        store.repairConversationProjectionActivity(actor, observedProjection(false, oldActivity), true);

        verify(readExactDirectory).bind(actor, activity, room);
        verifyNoInteractions(readSlots, removeDirectory, saveDirectory);
    }

    private CanonicalCqlStore.ConversationProjectionRow observedProjection(boolean pinned) {
        return observedProjection(pinned, activity);
    }

    private CanonicalCqlStore.ConversationProjectionRow observedProjection(boolean pinned, Instant sourceActivity) {
        var conversation = mock(CanonicalConversation.class);
        when(conversation.conversationId()).thenReturn(room);
        when(conversation.lastActivityAt()).thenReturn(activity);
        return new CanonicalCqlStore.ConversationProjectionRow(conversation, pinned, 8, joinedAt, "MENTIONS", null, sourceActivity);
    }

    private UdtValue canonicalPreview(UUID id, Instant canonicalActivity) {
        var latest = mock(UdtValue.class);
        when(latest.getUuid("message_id")).thenReturn(id);
        var row = mock(Row.class);
        when(row.getInstant("last_activity_at")).thenReturn(canonicalActivity);
        when(row.getUdtValue("last_message")).thenReturn(latest);
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(readCanonical.bind(room)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        when(result.one()).thenReturn(row);
        return latest;
    }

    private UdtValue activitySource(Instant oldActivity) {
        return activitySource(oldActivity, Uuids.startOf(oldActivity.toEpochMilli()));
    }

    private UdtValue activitySource(Instant oldActivity, UUID sourceId) {
        var previous = mock(UdtValue.class);
        when(previous.getUuid("message_id")).thenReturn(sourceId);
        var source = mock(Row.class);
        when(source.getInstant("joined_at")).thenReturn(joinedAt);
        when(source.getInstant("last_activity_at")).thenReturn(oldActivity);
        when(source.getUdtValue("last_message")).thenReturn(previous);
        when(source.getString("conversation_type")).thenReturn("GROUP");
        when(source.getString("visibility")).thenReturn("PRIVATE_LINK");
        when(source.getSet("role_ids", UUID.class)).thenReturn(roles);
        when(source.getInt("unread_count")).thenReturn(8);
        when(source.getString("notification_override")).thenReturn("MENTIONS");
        projectionPlanes(oldActivity, List.of(source));
        return previous;
    }

    private void projectionPlanes(Instant at, List<Row> rows) {
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(readExactDirectory.bind(actor, at, room)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        when(result.all()).thenReturn(rows);
    }

    private BoundStatement membershipLookup(Row member) {
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(readMembership.bind(room, actor)).thenReturn(query);
        when(session.execute(query)).thenReturn(result);
        when(result.one()).thenReturn(member);
        return query;
    }

    private record DirectoryMove(BoundStatement read, BoundStatement delete, BoundStatement insert) {}

    private DirectoryMove directoryMove(boolean wasPinned, PreparedStatement projectionRead, boolean applied) {
        return directoryMove(wasPinned, projectionRead, applied, actor);
    }

    private DirectoryMove directoryMove(boolean wasPinned, PreparedStatement projectionRead, boolean applied, Object... key) {
        var directoryRead = mock(BoundStatement.class, RETURNS_SELF);
        var directoryResult = mock(ResultSet.class);
        var delete = mock(BoundStatement.class);
        var insert = mock(BoundStatement.class);
        var directory = mock(Row.class);
        var batchResult = mock(ResultSet.class);
        when(projectionRead.bind(key)).thenReturn(directoryRead);
        when(session.execute(directoryRead)).thenReturn(directoryResult);
        when(directoryResult.all()).thenReturn(List.of(directory));
        when(directory.getUuid("conversation_id")).thenReturn(room);
        when(directory.getBoolean("is_pinned")).thenReturn(wasPinned);
        when(directory.getInstant("last_activity_at")).thenReturn(activity);
        when(directory.getString("conversation_type")).thenReturn("GROUP");
        when(directory.getString("visibility")).thenReturn("PRIVATE_LINK");
        when(directory.getSet("role_ids", UUID.class)).thenReturn(roles);
        when(directory.getInstant("joined_at")).thenReturn(joinedAt);
        when(directory.getInt("unread_count")).thenReturn(8);
        when(directory.getString("notification_override")).thenReturn("MENTIONS");
        when(removeDirectory.bind(actor, wasPinned, activity, room, joinedAt, null, 8)).thenReturn(delete);
        when(saveDirectory.bind(actor, !wasPinned, activity, room, "GROUP", "PRIVATE_LINK", roles, joinedAt, null, 8, "MENTIONS"))
                .thenReturn(insert);
        when(session.execute(any(BatchStatement.class))).thenReturn(batchResult);
        when(batchResult.wasApplied()).thenReturn(applied);
        return new DirectoryMove(directoryRead, delete, insert);
    }

    private static void assertMove(BatchStatement batch, DirectoryMove move) {
        assertThat(batch).containsExactly(move.delete(), move.insert());
        assertThat(batch.getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(batch.getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        assertThat(batch.getSerialConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_SERIAL);
    }
}
