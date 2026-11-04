package com.chatapp.chat_service.canonical.message;

import com.datastax.oss.driver.api.core.*;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessagePinSlotRepositoryTest {
    final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    final PreparedStatement scan = mock(PreparedStatement.class), release = mock(PreparedStatement.class), projection = mock(PreparedStatement.class);
    final PreparedStatement advance = mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
    final BoundStatement scanned = mock(BoundStatement.class, RETURNS_SELF), released = mock(BoundStatement.class, RETURNS_SELF);
    final ResultSet releaseResult = mock(ResultSet.class), rows = mock(ResultSet.class);
    final UUID room = UUID.randomUUID(), message = Uuids.timeBased(), actor = UUID.randomUUID(), generation = Uuids.timeBased();
    final String bucket = "2026-10-23-08:00";
    final List<String> queries = new ArrayList<>();
    final CassandraMessageRepository repository;

    MessagePinSlotRepositoryTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0); queries.add(query);
            if (query.contains("SELECT pin_slot")) return scan;
            if (query.contains("SET pin_revision = ?")) return advance;
            if (query.contains("DELETE FROM pinned_message_slots")) return release;
            if (query.contains("SET is_pinned =")) return projection;
            return mock(PreparedStatement.class, RETURNS_DEEP_STUBS);
        });
        when(scan.bind(room)).thenReturn(scanned);
        when(session.execute(scanned)).thenReturn(rows);
        when(release.bind(any(Object[].class))).thenReturn(released);
        when(projection.bind(any(Object[].class))).thenReturn(mock(BoundStatement.class, RETURNS_SELF));
        when(session.execute(released)).thenReturn(releaseResult);
        when(session.execute(any(BatchStatement.class))).thenReturn(releaseResult);
        var row = mock(Row.class);
        when(row.getUuid("message_id")).thenReturn(message);
        when(row.getString("message_bucket")).thenReturn(bucket);
        when(row.getUuid("pinned_at")).thenReturn(generation);
        when(row.getByte("pin_slot")).thenReturn((byte) 2);
        when(rows.iterator()).thenAnswer(ignored -> List.of(row).iterator());
        when(rows.all()).thenReturn(List.of(row));
        repository = new CassandraMessageRepository(session);
    }
    @Test void releaseIsFencedByExactMessageAndObservedTimeuuidGeneration() {
        when(releaseResult.wasApplied()).thenReturn(true);
        assertThat(repository.changePin(room, bucket, message, actor, false, 0L).changed()).isTrue();
        assertThat(queries.stream().filter(query -> query.contains("DELETE FROM pinned_message_slots")).toList())
                .singleElement().asString().contains("IF message_bucket = ? AND message_id = ? AND pinned_at = ?");
        verify(release).bind(room, (byte) 2, bucket, message, generation);
        var batch = org.mockito.ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(batch.capture());
        assertThat(batch.getValue().getConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_QUORUM);
        assertThat(batch.getValue().getSerialConsistencyLevel()).isEqualTo(DefaultConsistencyLevel.LOCAL_SERIAL);
        verify(projection).bind(false, room, bucket, message);
    }
    @Test void lostOwnershipMustNotClearMessageProjectionOrReportSuccess() {
        when(releaseResult.wasApplied()).thenReturn(false);
        assertThatThrownBy(() -> repository.changePin(room, bucket, message, actor, false, 0L))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);
        verifyNoInteractions(projection);
    }
    @Test void missingGenerationIsInvariantFailureNotAnUnfencedDelete() {
        when(rows.iterator().next().getUuid("pinned_at")).thenReturn(null);
        assertThatThrownBy(() -> repository.changePin(room, bucket, message, actor, false, 0L))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(release, projection);
    }
    @Test void unrelatedSlotsAreNotReleased() {
        when(rows.iterator().next().getUuid("message_id")).thenReturn(Uuids.timeBased());
        assertThat(repository.changePin(room, bucket, message, actor, false, 0L).changed()).isFalse();
        verifyNoInteractions(release);
    }
    @Test void creatingAPinMustSerializeCapacityAndSlotWriteInOneConditionalPartitionBatch() {
        when(rows.iterator()).thenAnswer(ignored -> Collections.emptyIterator());
        var marker = mock(Row.class);
        when(marker.isNull("pin_slot")).thenReturn(true);
        when(marker.getLong("pin_revision")).thenReturn(0L);
        when(rows.all()).thenReturn(List.of(marker));
        var applied = mock(ResultSet.class);
        when(applied.wasApplied()).thenReturn(true);
        when(session.execute(any(BatchStatement.class))).thenReturn(applied);
        assertThat(repository.changePin(room, bucket, message, actor, true, 0L).changed()).isTrue();
        verify(session).execute(any(BatchStatement.class));
        verify(advance).bind(1L, room, 0L);
        assertThat(queries.stream().filter(query -> query.contains("SET pin_revision = ?")).toList())
                .singleElement().asString().contains("WHERE conversation_id = ? IF pin_revision = ?");
    }
    @Test void fiveDistinctPinsRejectAnotherWithoutWriting() {
        var occupied = java.util.stream.IntStream.range(0, 5)
                .mapToObj(number -> slot((byte) number, Uuids.timeBased(), 9L)).toList();
        when(rows.all()).thenReturn(occupied);
        assertThatThrownBy(() -> repository.changePin(room, bucket, message, actor, true, 9L))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class).hasMessageContaining("at most 5");
        verify(session, never()).execute(any(BatchStatement.class));
        verifyNoInteractions(projection);
    }
    @Test void losingConcurrentSameMessageClaimIsAnIdempotentNoopAfterReload() {
        var marker = mock(Row.class);
        when(marker.isNull("pin_slot")).thenReturn(true);
        var committed = slot((byte) 0, message, 1L);
        when(rows.all()).thenReturn(List.of(marker), List.of(committed));
        when(releaseResult.wasApplied()).thenReturn(false);
        assertThat(repository.changePin(room, bucket, message, actor, true, 0L).changed()).isFalse();
        verify(session, times(1)).execute(any(BatchStatement.class));
    }
    @Test void revisionOverflowDoesNotWrapOrWrite() {
        var max = slot((byte) 0, Uuids.timeBased(), Long.MAX_VALUE);
        when(rows.all()).thenReturn(List.of(max));
        assertThatThrownBy(() -> repository.changePin(room, bucket, message, actor, true, Long.MAX_VALUE))
                .isInstanceOf(ArithmeticException.class);
        verify(session, never()).execute(any(BatchStatement.class));
        verifyNoInteractions(projection);
    }
    @Test void populatedUnversionedAggregateIsNotSilentlyInitializedAsRevisionZero() {
        when(rows.iterator().next().isNull("pin_revision")).thenReturn(true);
        assertThatThrownBy(() -> repository.changePin(room, bucket, message, actor, true, 0L))
                .isInstanceOf(IllegalStateException.class);
        verify(session, never()).execute(any(BatchStatement.class));
        verifyNoInteractions(projection);
    }
    Row slot(byte number, UUID id, long revision) {
        var row = mock(Row.class);
        when(row.getLong("pin_revision")).thenReturn(revision);
        when(row.getByte("pin_slot")).thenReturn(number);
        when(row.getUuid("message_id")).thenReturn(id);
        when(row.getString("message_bucket")).thenReturn(bucket);
        when(row.getUuid("pinned_at")).thenReturn(Uuids.timeBased());
        return row;
    }
    @Test void stalePinIntentCannotRepinAfterAnInterveningUnpin() {
        var marker = mock(Row.class);
        when(marker.isNull("pin_slot")).thenReturn(true);
        when(marker.getLong("pin_revision")).thenReturn(2L);
        when(rows.all()).thenReturn(List.of(marker));
        assertThatThrownBy(() -> repository.changePin(room, bucket, message, actor, true, 0L))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);
        verify(session, never()).execute(any(BatchStatement.class));
    }
}
