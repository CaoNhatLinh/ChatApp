package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserJoinRequestRepositoryTest {
    private final CqlSession session = mock(CqlSession.class);
    private final UUID user = UUID.randomUUID();
    private final UUID time = Uuids.timeBased();
    private final Map<BoundStatement, Object[]> bindings = new IdentityHashMap<>();
    private final List<BoundStatement> executed = new ArrayList<>();
    private List<Row> first = List.of();
    private List<Row> same = List.of();
    private List<Row> older = List.of();
    private Row authority;
    private UserJoinRequestRepository repository;

    @BeforeEach
    void setup() {
        when(session.prepare(anyString())).thenAnswer(call -> {
            PreparedStatement prepared = mock(PreparedStatement.class);
            when(prepared.getQuery()).thenReturn(call.getArgument(0));
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                BoundStatement bound = mock(BoundStatement.class);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                bindings.put(bound, binding.getArguments());
                return bound;
            });
            return prepared;
        });
        when(session.execute(any(BoundStatement.class))).thenAnswer(call -> {
            BoundStatement bound = call.getArgument(0);
            executed.add(bound);
            String query = bound.getPreparedStatement().getQuery();
            ResultSet result = mock(ResultSet.class);
            if (query.contains("join_requests_by_user")) {
                when(result.all()).thenReturn(query.contains("request_id >") ? same
                        : query.contains("requested_at <") ? older : first);
            } else {
                when(result.one()).thenReturn(authority);
            }
            return result;
        });
        repository = new UserJoinRequestRepository(session);
    }

    @Test
    void cursorRoundTripsBothClusteringKeys() {
        var cursor = new UserJoinRequestRepository.Cursor(time, UUID.randomUUID());
        assertThat(UserJoinRequestRepository.decodeCursor(UserJoinRequestRepository.encodeCursor(cursor))).isEqualTo(cursor);
    }

    @Test
    void invalidCursorsAndLimitsNeverExecuteQueries() {
        for (String cursor : List.of("", "!", "a".repeat(129),
                UserJoinRequestRepository.encodeCursor(new UserJoinRequestRepository.Cursor(UUID.randomUUID(), UUID.randomUUID())))) {
            assertThatThrownBy(() -> repository.list(user, cursor, 25)).isInstanceOf(BadRequestException.class);
        }
        assertThatThrownBy(() -> repository.list(user, null, 0)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> repository.list(user, null, 51)).isInstanceOf(BadRequestException.class);
        assertThat(executed).isEmpty();
    }

    @Test
    void emptyPageIsScopedToAuthenticatedUser() {
        var page = repository.list(user, null, 25);
        assertThat(page.content()).isEmpty();
        assertThat(page.nextCursor()).isNull();
        assertThat(page.hasNext()).isFalse();
        assertThat(bindings.get(executed.get(0))).containsExactly(user, 26);
    }

    @Test
    void currentStatusWinsOverStaleIndexAndLookaheadIsNotHydrated() {
        first = List.of(index(UUID.randomUUID(), UUID.randomUUID()), index(UUID.randomUUID(), UUID.randomUUID()));
        authority = authority(user, "APPROVED");
        var page = repository.list(user, null, 1);
        assertThat(page.content()).extracting(UserJoinRequestRepository.View::status).containsExactly("APPROVED");
        assertThat(page.content().get(0).resolvedAt()).isEqualTo(Instant.EPOCH);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotNull();
        assertThat(executed).hasSize(2);
    }

    @Test
    void tiesAreContinuedBeforeEarlierTimesWithRemainingBound() {
        UUID request = UUID.randomUUID();
        same = List.of(index(UUID.randomUUID(), null));
        older = List.of(index(UUID.randomUUID(), null));
        var cursor = new UserJoinRequestRepository.Cursor(time, request);
        var page = repository.list(user, UserJoinRequestRepository.encodeCursor(cursor), 1);
        assertThat(bindings.get(executed.get(0))).containsExactly(user, time, request, 2);
        assertThat(bindings.get(executed.get(1))).containsExactly(user, time, 1);
        assertThat(page.hasNext()).isTrue();
        assertThat(executed.get(2).getPreparedStatement().getQuery()).contains("community_join_request_by_user");
    }

    @Test
    void fullTiePageDoesNotQueryEarlierTimes() {
        same = List.of(index(UUID.randomUUID(), null), index(UUID.randomUUID(), null));
        repository.list(user, UserJoinRequestRepository.encodeCursor(
                new UserJoinRequestRepository.Cursor(time, UUID.randomUUID())), 1);
        assertThat(executed).hasSize(2);
        assertThat(executed).noneMatch(bound -> bound.getPreparedStatement().getQuery().contains("requested_at <"));
    }

    @Test
    void missingOrForeignAuthorityCannotExposeItsOutcome() {
        first = List.of(index(UUID.randomUUID(), UUID.randomUUID()));
        assertThat(repository.list(user, null, 25).content().get(0).status()).isEqualTo("RETRY_REQUIRED");
        authority = authority(UUID.randomUUID(), "APPROVED");
        var view = repository.list(user, null, 25).content().get(0);
        assertThat(view.status()).isEqualTo("RETRY_REQUIRED");
        assertThat(view.resolvedAt()).isNull();
    }

    @Test
    void communityUsesCurrentClaimInsteadOfStaleManagerProjection() {
        UUID requestId = UUID.randomUUID();
        first = List.of(index(requestId, null));
        authority = authority(user, "APPROVED");
        when(authority.getUuid("request_id")).thenReturn(requestId);
        when(authority.getUuid("requested_at")).thenReturn(time);
        assertThat(repository.list(user, null, 25).content().get(0).status()).isEqualTo("APPROVED");
        assertThat(executed).hasSize(2);
        assertThat(executed.get(1).getPreparedStatement().getQuery()).contains("community_join_request_by_user");
    }

    @Test
    void replacedCommunityAttemptCannotReportHistoricalPendingAsCurrent() {
        first = List.of(index(UUID.randomUUID(), null));
        authority = authority(user, "PENDING");
        when(authority.getUuid("request_id")).thenReturn(UUID.randomUUID());
        when(authority.getUuid("requested_at")).thenReturn(time);
        assertThat(repository.list(user, null, 25).content().get(0).status()).isEqualTo("RETRY_REQUIRED");
    }

    private Row index(UUID requestId, UUID linkId) {
        Row row = mock(Row.class);
        when(row.getUuid("conversation_id")).thenReturn(UUID.randomUUID());
        when(row.getUuid("requested_at")).thenReturn(time);
        when(row.getUuid("request_id")).thenReturn(requestId);
        when(row.getUuid("link_id")).thenReturn(linkId);
        return row;
    }

    private Row authority(UUID owner, String status) {
        Row row = mock(Row.class);
        when(row.getUuid("user_id")).thenReturn(owner);
        when(row.getString("status")).thenReturn(status);
        when(row.getInstant("resolved_at")).thenReturn(Instant.EPOCH);
        return row;
    }
}
