package com.chatapp.chat_service.canonical.media;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MediaAssetRetentionTest {
    @Test void retentionAndDeletionFenceOnTheSameAssetAuthority() {
        var session = mock(CqlSession.class);
        List<String> executed = new ArrayList<>();
        when(session.prepare(anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            var prepared = mock(PreparedStatement.class);
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                var bound = mock(BoundStatement.class, RETURNS_SELF);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                when(prepared.getQuery()).thenReturn(query);
                return bound;
            });
            return prepared;
        });
        when(session.execute(any(BoundStatement.class))).thenAnswer(call -> {
            BoundStatement bound = call.getArgument(0);
            executed.add(bound.getPreparedStatement().getQuery());
            var result = mock(ResultSet.class);
            when(result.wasApplied()).thenReturn(executed.size() == 1);
            return result;
        });
        var repository = new MediaAssetRepository(session, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
        UUID asset = UUID.randomUUID();
        assertThat(repository.retainForHistory(asset)).isTrue();
        assertThat(repository.claimDeletion(asset)).isFalse();
        assertThat(executed.get(0)).contains("SET retention_locked=true", "IF upload_status='READY' AND deleted_at=null");
        assertThat(executed.get(1)).contains("SET upload_status='DELETING'", "retention_locked=false", "deleted_at=null");
    }
}
