package com.chatapp.chat_service.canonical.sticker;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CassandraStickerRepositoryTest {
    private final CqlSession session = mock(CqlSession.class);
    private final Map<BoundStatement, Object[]> bindings = new IdentityHashMap<>();
    private final List<BoundStatement> executed = new ArrayList<>();
    private CassandraStickerRepository repository;

    @BeforeEach void setup() {
        when(session.prepare(anyString())).thenAnswer(call -> {
            var prepared = mock(PreparedStatement.class);
            when(prepared.getQuery()).thenReturn(call.getArgument(0));
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                var bound = mock(BoundStatement.class);
                when(bound.setConsistencyLevel(any())).thenReturn(bound);
                when(bound.setSerialConsistencyLevel(any())).thenReturn(bound);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                bindings.put(bound, binding.getArguments());
                return bound;
            });
            return prepared;
        });
        when(session.execute(any(BoundStatement.class))).thenAnswer(call -> {
            executed.add(call.getArgument(0));
            var result = mock(ResultSet.class);
            when(result.all()).thenReturn(List.of());
            when(result.wasApplied()).thenReturn(true);
            return result;
        });
        repository = new CassandraStickerRepository(session, new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules());
    }

    @Test void directoryUsesGlobalPartitionAndBoundedLookahead() {
        UUID after = UUID.randomUUID();
        repository.packIds(after, 51);
        assertThat(executed.get(0).getPreparedStatement().getQuery())
                .contains("catalog = 'GLOBAL'", "sticker_pack_id > ?", "LIMIT ?").doesNotContain("ALLOW FILTERING");
        assertThat(bindings.get(executed.get(0))).containsExactly(after, 51);
    }

    @Test void itemCursorContinuesBothClusteringKeysWithinOnePack() {
        UUID pack = UUID.randomUUID(), sticker = UUID.randomUUID();
        repository.positions(pack, new StickerRepository.Position(4, sticker), 26);
        assertThat(executed.get(0).getPreparedStatement().getQuery()).contains("(position,entry_id) > (?,?)", "LIMIT ?");
        assertThat(bindings.get(executed.get(0))).containsExactly(pack, 4, sticker, 26);
    }

    @Test void authorityQueriesArePointLookupsAndLimitsAreClamped() {
        UUID pack = UUID.randomUUID(), sticker = UUID.randomUUID();
        assertThat(repository.findPack(pack)).isNull();
        assertThat(repository.findSticker(sticker)).isNull();
        repository.positions(pack, null, 1000);
        repository.packIds(null, 0);
        assertThat(bindings.get(executed.get(0))).containsExactly(pack, pack);
        assertThat(bindings.get(executed.get(1))).containsExactly(sticker);
        assertThat(bindings.get(executed.get(2))).containsExactly(pack, 51);
        assertThat(bindings.get(executed.get(3))).containsExactly(1);
    }

    @Test void packCreationCommitsAuthorityCommandAndPendingAuditInOneConditionalPartition() {
        UUID packId = UUID.randomUUID(), commandId = UUID.randomUUID();
        var pack = new StickerRepository.Pack(packId, "Name", "", null, false, false, UUID.randomUUID(), java.time.Instant.now());
        var command = new StickerRepository.Command(commandId, UUID.randomUUID(), "hash", pack, null, null);
        assertThat(repository.createPack(command)).isTrue();
        BoundStatement batch = executed.get(1);
        String query = batch.getPreparedStatement().getQuery();
        assertThat(query).startsWith("BEGIN BATCH").contains("'PACK'", "'COMMAND'", "'PENDING'", "IF NOT EXISTS")
                .doesNotContain("sticker_pack_directory", "sticker_identity_by_id");
        Object[] values = bindings.get(batch);
        assertThat(query.chars().filter(character -> character == '?').count()).isEqualTo(values.length);
        assertThat(values[0]).isEqualTo(packId);
        assertThat(values[9]).isEqualTo(packId);
        assertThat(values[12]).isEqualTo(packId);
        verify(batch).setConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(batch).setSerialConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_SERIAL);
    }

    @Test void reorderAtomicallyRemovesOldPositionAndAddsNewWithRevisionAndCommandFence() {
        UUID packId = UUID.randomUUID(), stickerId = UUID.randomUUID(), previousRevision = UUID.randomUUID();
        var pack = new StickerRepository.Pack(packId, "Name", "", null, false, true, UUID.randomUUID(), java.time.Instant.now());
        var previous = new StickerRepository.Sticker(stickerId, packId, "Wave", UUID.randomUUID(), 1, true, UUID.randomUUID());
        var next = new StickerRepository.Sticker(stickerId, packId, "Wave", previous.assetId(), 4, true, UUID.randomUUID());
        var command = new StickerRepository.Command(UUID.randomUUID(), UUID.randomUUID(), "hash", pack, next, null);
        assertThat(repository.changeSticker(command, previousRevision, previous)).isTrue();
        BoundStatement batch = executed.get(1);
        String query = batch.getPreparedStatement().getQuery();
        assertThat(query).contains("IF pack_revision=?", "DELETE FROM sticker_catalog_by_pack", "'COMMAND'", "IF NOT EXISTS", "'PENDING'");
        Object[] values = bindings.get(batch);
        assertThat(query.chars().filter(character -> character == '?').count()).isEqualTo(values.length);
        assertThat(values[8]).isEqualTo(previousRevision);
        assertThat(values[16]).isEqualTo(packId);
        assertThat(values[17]).isEqualTo(1);
        assertThat(values[19]).isEqualTo(packId);
        assertThat(values[20]).isEqualTo(4);
    }
}
