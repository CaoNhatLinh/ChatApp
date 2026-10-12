package com.chatapp.chat_service.canonical.message;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CassandraReadPointerTest {
    @Mock CqlSession session;
    @Mock PreparedStatement load;
    @Mock PreparedStatement advance;
    @Mock BoundStatement readStatement;
    @Mock BoundStatement writeStatement;
    @Mock ResultSet readResult;
    @Mock ResultSet writeResult;
    @Mock Row row;
    CassandraReadPointer pointer;
    final UUID room = UUID.randomUUID();
    final UUID reader = UUID.randomUUID();
    final UUID target = Uuids.startOf(1790992800000L);

    @BeforeEach
    void setUp() {
        when(session.prepare(startsWith("SELECT"))).thenReturn(load);
        when(session.prepare(startsWith("UPDATE"))).thenReturn(advance);
        pointer = new CassandraReadPointer(session);
        when(load.bind(room, reader)).thenReturn(readStatement);
        when(session.execute(readStatement)).thenReturn(readResult);
    }

    @Test
    void retriesCasAndDoesNotRegressWhenAnotherReaderAdvances() {
        when(readResult.one()).thenReturn(row);
        when(row.getInstant("joined_at")).thenReturn(Instant.EPOCH);
        UUID newer = new UUID(target.getMostSignificantBits() + (1L << 32), target.getLeastSignificantBits());
        when(row.getUuid("last_read_message_id")).thenReturn(null, newer);
        when(advance.bind(any(), any(), any(), any(), any(), any())).thenReturn(writeStatement);
        when(session.execute(writeStatement)).thenReturn(writeResult);
        when(writeResult.wasApplied()).thenReturn(false);
        assertThat(pointer.advance(room, reader, target, Instant.now())).isFalse();
        verify(session, times(1)).execute(writeStatement);
    }

    @Test
    void missingMembershipCannotBeRecreatedByRead() {
        when(readResult.one()).thenReturn(null);
        assertThat(pointer.advance(room, reader, target, Instant.now())).isFalse();
        verifyNoInteractions(advance);
    }

    @Test
    void equalPointerAllowsReceiptRepairWithoutAnotherCas() {
        when(readResult.one()).thenReturn(row);
        when(row.getInstant("joined_at")).thenReturn(Instant.EPOCH);
        when(row.getUuid("last_read_message_id")).thenReturn(target);
        assertThat(pointer.advance(room, reader, target, Instant.now())).isTrue();
        verifyNoInteractions(advance);
    }

    @Test
    void advancesThroughConditionalUpdate() {
        when(readResult.one()).thenReturn(row);
        when(row.getInstant("joined_at")).thenReturn(Instant.EPOCH);
        when(advance.bind(any(), any(), any(), any(), any(), any())).thenReturn(writeStatement);
        when(session.execute(writeStatement)).thenReturn(writeResult);
        when(writeResult.wasApplied()).thenReturn(true);
        assertThat(pointer.advance(room, reader, target, Instant.now())).isTrue();
        verify(advance).bind(eq(target), any(), eq(room), eq(reader), isNull(), eq(Instant.EPOCH));
    }
}
