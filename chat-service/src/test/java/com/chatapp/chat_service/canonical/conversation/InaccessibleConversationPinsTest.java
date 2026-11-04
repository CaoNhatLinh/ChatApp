package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class InaccessibleConversationPinsTest {
    private final UUID actor = UUID.randomUUID();
    private final UUID room = UUID.randomUUID();
    private final UUID generation = Uuids.timeBased();
    private final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    private final PreparedStatement slots = mock(PreparedStatement.class);
    private final PreparedStatement membership = mock(PreparedStatement.class);
    private final PreparedStatement renew = mock(PreparedStatement.class);
    private final PreparedStatement release = mock(PreparedStatement.class);
    private final PreparedStatement projection = mock(PreparedStatement.class);
    private final PreparedStatement other = mock(PreparedStatement.class);
    private final CanonicalCqlStore store;

    InaccessibleConversationPinsTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("message_summary")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(other);
        when(session.prepare(contains("SELECT * FROM pinned_conversation_slots_by_user WHERE user_id = ?"))).thenReturn(slots);
        when(session.prepare(contains("SELECT * FROM conversation_members_by_conversation\nWHERE conversation_id = ? AND user_id = ?")))
                .thenReturn(membership);
        when(session.prepare(contains("SELECT * FROM conversations_by_user WHERE user_id = ? AND is_pinned IN (true, false)")))
                .thenReturn(projection);
        when(session.prepare(argThat((String query) -> query != null && query.startsWith("UPDATE pinned_conversation_slots_by_user SET pinned_at = now()")
                && query.contains("IF conversation_id = ? AND pinned_at = ?")))).thenReturn(renew);
        when(session.prepare(argThat((String query) -> query != null && query.startsWith("DELETE FROM pinned_conversation_slots_by_user")
                && query.contains("IF conversation_id = ? AND pinned_at = ?")))).thenReturn(release);
        store = new CanonicalCqlStore(session);
    }

    @Test
    void reclaimsOnlyVerifiedAbsentMembershipAndNeverMovesDirectoryRows() {
        UUID activeRoom = UUID.randomUUID();
        var observed = List.of(slot((byte) 0, room, generation), slot((byte) 1, activeRoom, Uuids.timeBased()));
        when(result(slots, actor).all()).thenReturn(observed);
        var active = mock(Row.class);
        when(result(membership, activeRoom, actor).one()).thenReturn(active);
        var absent = result(membership, room, actor);
        when(absent.one()).thenReturn(null);
        when(result(release, actor, (byte) 0, room, generation).wasApplied()).thenReturn(true);

        assertThat(store.reclaimInaccessibleConversationPins(actor)).isTrue();
        verify(release).bind(actor, (byte) 0, room, generation);
        verifyNoMoreInteractions(release);
        verifyNoInteractions(projection, renew, other);
    }

    @Test
    void staleCleanupDoesNotReleaseAPinWhoseGenerationWasRenewed() {
        var observed = slot((byte) 0, room, generation);
        when(result(slots, actor).all()).thenReturn(List.of(observed));
        when(result(membership, room, actor).one()).thenReturn(null);
        when(result(release, actor, (byte) 0, room, generation).wasApplied()).thenReturn(false);

        assertThat(store.reclaimInaccessibleConversationPins(actor)).isFalse();
        verify(release).bind(actor, (byte) 0, room, generation);
        verifyNoMoreInteractions(release);
        verifyNoInteractions(projection, renew, other);
    }

    @Test
    void explicitRepinRenewsTheExactGenerationAndRejectsLostRenewal() {
        var observed = slot((byte) 0, room, generation);
        when(result(slots, actor).all()).thenReturn(List.of(observed));
        Row directory = mock(Row.class);
        when(directory.getUuid("conversation_id")).thenReturn(room);
        when(directory.getBoolean("is_pinned")).thenReturn(true);
        when(result(projection, actor).all()).thenReturn(List.of(directory));
        when(result(renew, actor, (byte) 0, room, generation).wasApplied()).thenReturn(true, false);

        assertThat(store.tryPinConversation(actor, room, 2)).isEqualTo(CanonicalCqlStore.ConversationPinResult.ALREADY_PINNED);
        assertThatThrownBy(() -> store.tryPinConversation(actor, room, 2)).isInstanceOf(ConflictException.class);
        verify(renew, times(2)).bind(actor, (byte) 0, room, generation);
        verifyNoInteractions(membership, release, other);
    }

    private ResultSet result(PreparedStatement statement, Object... parameters) {
        var bound = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(ResultSet.class);
        when(statement.bind(parameters)).thenReturn(bound);
        when(session.execute(bound)).thenReturn(result);
        return result;
    }

    private Row slot(byte index, UUID conversation, UUID pinnedAt) {
        Row row = mock(Row.class);
        when(row.getByte("pin_slot")).thenReturn(index);
        when(row.getUuid("conversation_id")).thenReturn(conversation);
        when(row.getUuid("pinned_at")).thenReturn(pinnedAt);
        return row;
    }
}
