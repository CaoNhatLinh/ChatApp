package com.chatapp.chat_service.canonical.poll;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CassandraPollRepositoryTest {
    @Test
    void createsThroughIndependentConditionalWritesAndNeverResetsTheAggregate() {
        CqlSession session = mock(CqlSession.class);
        var statements = new LinkedHashMap<String, BoundStatement>();
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String cql = invocation.getArgument(0);
            PreparedStatement prepared = mock(PreparedStatement.class);
            BoundStatement bound = mock(BoundStatement.class);
            lenient().when(prepared.bind(any(Object[].class))).thenReturn(bound);
            statements.put(cql, bound);
            return prepared;
        });
        ResultSet result = mock(ResultSet.class);
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        when(result.wasApplied()).thenReturn(true);
        CassandraPollRepository repository = new CassandraPollRepository(session);
        repository.create(new CanonicalPoll(UUID.randomUUID(), UUID.randomUUID(), "2026-10-03-01:00",
                UUID.randomUUID(), "Where?", List.of("Here", "There"), false, false, false,
                UUID.randomUUID(), Instant.now(), null, null, null));
        String primary = statements.keySet().stream().filter(sql -> sql.contains("INSERT INTO polls_by_id")).findFirst().orElseThrow();
        String aggregate = statements.keySet().stream().filter(sql -> sql.contains("INSERT INTO poll_state_by_poll") && sql.contains("option_counts")).findFirst().orElseThrow();
        assertThat(primary).contains("IF NOT EXISTS");
        assertThat(aggregate).contains("IF NOT EXISTS");
        var ordered = inOrder(session);
        ordered.verify(session).execute(statements.get(primary));
        ordered.verify(session).execute(statements.get(aggregate));
        verify(session, never()).execute(any(BatchStatement.class));
    }
}
