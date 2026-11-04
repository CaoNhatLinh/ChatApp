package com.chatapp.chat_service.canonical.email;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.DefaultConsistencyLevel;
import com.datastax.oss.driver.api.core.cql.AsyncResultSet;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.ResultSet;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class CassandraEmailHistoryReaderTest {
    private static final String MONTH = "2026-10";
    private final UUID user = UUID.randomUUID();
    private final CqlSession session = mock(CqlSession.class);
    private final PreparedStatement first = mock(PreparedStatement.class);
    private final PreparedStatement before = mock(PreparedStatement.class);
    private final PreparedStatement delivery = mock(PreparedStatement.class);

    private CassandraEmailHistoryReader reader() {
        when(session.prepare(anyString())).thenAnswer(invocation -> {
            String query = invocation.getArgument(0);
            if (query.contains("FROM notifications_by_user")) {
                assertThat(query).contains("SELECT notification_id", "WHERE user_id = ? AND notification_month = ?");
                return query.contains("notification_id < ?") ? before : first;
            }
            assertThat(query).contains("SELECT channel, delivery_status, attempted_at, delivered_at",
                            "WHERE user_id = ? AND notification_month = ? AND notification_id = ? AND device_id = ?")
                    .doesNotContain("request_json", "provider_message_id", "failure_code");
            return delivery;
        });
        return new CassandraEmailHistoryReader(session);
    }

    @Test
    void discoveryIsScopedAndBoundedIncludingTheLookahead() {
        var reader = reader();
        UUID latest = Uuids.timeBased(), older = Uuids.timeBased();
        var initial = mock(BoundStatement.class, RETURNS_SELF);
        var next = mock(BoundStatement.class, RETURNS_SELF);
        when(first.bind(user, MONTH, 51)).thenReturn(initial);
        when(before.bind(user, MONTH, latest, 8)).thenReturn(next);
        stubNotification(initial, latest);
        stubNotification(next, older);

        assertThat(reader.notificationIds(user, MONTH, null, 500)).containsExactly(latest);
        assertThat(reader.notificationIds(user, MONTH, latest, 8)).containsExactly(older);
        verify(initial).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(next).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verifyNoInteractions(delivery);
    }

    @Test
    void hydrationFiltersMissingAndOtherChannelsWithoutReorderingEmailRows() {
        var reader = reader();
        UUID latest = Uuids.timeBased(), missing = Uuids.timeBased(), push = Uuids.timeBased(), older = Uuids.timeBased();
        Instant attempted = Instant.parse("2026-10-23T00:30:00Z");
        Instant delivered = attempted.plusSeconds(2);
        var firstRead = stubDelivery(latest, deliveryRow("EMAIL", "SENT", attempted, null));
        stubDelivery(missing, null);
        stubDelivery(push, deliveryRow("WEB_PUSH", "DELIVERED", attempted, delivered));
        var lastRead = stubDelivery(older, deliveryRow("EMAIL", "DELIVERED", attempted, delivered));

        assertThat(reader.deliveries(user, MONTH, List.of(latest, missing, push, older)))
                .containsExactly(new CassandraEmailHistoryReader.DeliveryItem(latest, "SENT", attempted, null),
                        new CassandraEmailHistoryReader.DeliveryItem(older, "DELIVERED", attempted, delivered));
        verify(firstRead).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(lastRead).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(delivery).bind(user, MONTH, latest, new UUID(0, 0));
    }

    @Test
    void failedHydrationDoesNotMasqueradeAsAnEmptyPage() {
        var reader = reader();
        UUID id = Uuids.timeBased();
        var bound = mock(BoundStatement.class, RETURNS_SELF);
        when(delivery.bind(user, MONTH, id, new UUID(0, 0))).thenReturn(bound);
        var failure = new IllegalStateException("ledger unavailable");
        when(session.executeAsync(bound)).thenReturn(CompletableFuture.failedFuture(failure));

        assertThatThrownBy(() -> reader.deliveries(user, MONTH, List.of(id)))
                .isInstanceOf(CompletionException.class).hasCause(failure);
        assertThatThrownBy(() -> reader.deliveries(user, MONTH, Collections.nCopies(51, id)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private void stubNotification(BoundStatement query, UUID id) {
        var result = mock(ResultSet.class);
        var row = mock(Row.class);
        when(session.execute(query)).thenReturn(result);
        when(result.all()).thenReturn(List.of(row));
        when(row.getUuid("notification_id")).thenReturn(id);
    }

    private BoundStatement stubDelivery(UUID id, Row row) {
        var query = mock(BoundStatement.class, RETURNS_SELF);
        var result = mock(AsyncResultSet.class);
        when(delivery.bind(user, MONTH, id, new UUID(0, 0))).thenReturn(query);
        when(session.executeAsync(query)).thenReturn(CompletableFuture.completedFuture(result));
        when(result.one()).thenReturn(row);
        return query;
    }

    private Row deliveryRow(String channel, String status, Instant attempted, Instant delivered) {
        var row = mock(Row.class);
        when(row.getString("channel")).thenReturn(channel);
        when(row.getString("delivery_status")).thenReturn(status);
        when(row.getInstant("attempted_at")).thenReturn(attempted);
        when(row.getInstant("delivered_at")).thenReturn(delivered);
        return row;
    }
}
